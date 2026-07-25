import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { db, queryRows } from "@/lib/db";
import { getAvailableSlots, newWaitlistPublicId } from "@/lib/waitlist";
import { assertPaymentMethodEnabled } from "@/lib/runtime-settings";

const playerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().regex(/^09\d{9}$/)
});

const schema = z.object({
  tournamentId: z.coerce.number().int().positive(),
  players: z.array(playerSchema).min(1).max(20),
  teamTitle: z.string().trim().min(2).max(140).optional(),
  teamId: z.coerce.number().int().positive().optional(),
  paymentMethod: z.enum(["card_to_card", "pos", "cash"]).default("card_to_card")
});

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  participant_type: "INDIVIDUAL" | "TEAM";
  team_size: number;
  allow_multi_slot: number;
  price: number;
  waitlist_mode: string;
  status: string;
  registration_starts_at: Date | null;
  registration_ends_at: Date | null;
  starts_at: Date;
};

type OwnedTeamRow = RowDataPacket & { id: number; title: string };
type OwnedTeamMemberRow = RowDataPacket & {
  player_id: number;
  name: string;
  mobile: string | null;
};

type PositionRow = RowDataPacket & { next_position: number };

async function loadOwnedTeam(
  connection: import("mysql2/promise").PoolConnection,
  teamId: number,
  userId: number
){
  const [teams] = await connection.query<OwnedTeamRow[]>(`
    SELECT t.id,t.title
    FROM teams t
    JOIN team_members captain ON captain.team_id=t.id AND captain.is_captain=1
    JOIN players captain_player ON captain_player.id=captain.player_id
    WHERE t.id=? AND captain_player.user_id=?
    LIMIT 1
    FOR UPDATE
  `, [teamId, userId]);
  if (!teams[0]) return null;

  const [members] = await connection.query<OwnedTeamMemberRow[]>(`
    SELECT tm.player_id,p.name,p.mobile
    FROM team_members tm
    JOIN players p ON p.id=tm.player_id
    WHERE tm.team_id=?
    ORDER BY tm.is_captain DESC,tm.joined_at,tm.player_id
    FOR UPDATE
  `, [teamId]);

  if (members.some((member) => !member.mobile || !/^09\d{9}$/.test(member.mobile))) {
    throw new Error("TEAM_MEMBER_MOBILE_REQUIRED");
  }

  return { team: teams[0], members };
}

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  }

  const rows = await queryRows<RowDataPacket[]>(`
    SELECT
      w.id,w.public_id,w.status,w.position,w.slots,w.amount,w.offer_token,
      w.offered_at,w.offer_expires_at,w.created_at,w.tournament_id,
      w.existing_team_id,t.title AS tournament_title,t.slug
    FROM waitlist_entries w
    JOIN tournaments t ON t.id=w.tournament_id
    WHERE w.user_id=?
    ORDER BY w.created_at DESC
  `, [user.id]);

  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user?.mobile || !/^\d+$/.test(user.id)) {
    return NextResponse.json({
      message: "برای ورود به صف انتظار، شماره موبایل را تأیید کنید."
    }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    await assertPaymentMethodEnabled(input.paymentMethod);
    const userId = Number(user.id);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<TournamentRow[]>(`
        SELECT
          id,title,participant_type,team_size,allow_multi_slot,price,waitlist_mode,
          status,registration_starts_at,registration_ends_at,starts_at
        FROM tournaments
        WHERE id=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [input.tournamentId]);
      const tournament = rows[0];
      const now = Date.now();

      if (
        !tournament
        || tournament.status !== "REGISTRATION_OPEN"
        || (tournament.registration_starts_at && new Date(tournament.registration_starts_at).getTime() > now)
        || (tournament.registration_ends_at && new Date(tournament.registration_ends_at).getTime() <= now)
        || new Date(tournament.starts_at).getTime() <= now
      ) {
        await connection.rollback();
        return NextResponse.json({ message: "صف انتظار این مسابقه فعال نیست." }, { status: 409 });
      }

      if (tournament.waitlist_mode === "disabled") {
        await connection.rollback();
        return NextResponse.json({ message: "صف انتظار برای این مسابقه غیرفعال است." }, { status: 409 });
      }

      let players = input.players.map((player) => ({
        name: player.name.trim(),
        mobile: player.mobile.trim()
      }));
      let teamTitle = input.teamTitle?.trim() || null;
      let existingTeamId: number | null = null;

      if (input.teamId) {
        if (tournament.participant_type !== "TEAM") {
          await connection.rollback();
          return NextResponse.json({ message: "برای مسابقه انفرادی نمی‌توان تیم انتخاب کرد." }, { status: 422 });
        }

        const ownedTeam = await loadOwnedTeam(connection, input.teamId, userId);
        if (!ownedTeam) {
          await connection.rollback();
          return NextResponse.json({ message: "فقط کاپیتان می‌تواند این تیم را وارد صف کند." }, { status: 403 });
        }

        players = ownedTeam.members.map((member) => ({
          name: member.name,
          mobile: member.mobile!
        }));
        teamTitle = ownedTeam.team.title;
        existingTeamId = ownedTeam.team.id;
      }

      const mobiles = players.map((player) => player.mobile);
      if (new Set(mobiles).size !== mobiles.length) {
        await connection.rollback();
        return NextResponse.json({ message: "هر شماره موبایل را فقط یک‌بار وارد کنید." }, { status: 409 });
      }

      const slots = tournament.participant_type === "TEAM" ? 1 : players.length;
      if (tournament.participant_type === "TEAM" && players.length !== Number(tournament.team_size)) {
        await connection.rollback();
        return NextResponse.json({
          message: `تعداد اعضای تیم باید ${tournament.team_size.toLocaleString("fa-IR")} نفر باشد.`
        }, { status: 422 });
      }

      if (tournament.participant_type === "INDIVIDUAL" && slots > 1 && !tournament.allow_multi_slot) {
        await connection.rollback();
        return NextResponse.json({ message: "ثبت چند شرکت‌کننده فعال نیست." }, { status: 422 });
      }

      const available = await getAvailableSlots(connection, tournament.id);
      if (available >= slots) {
        await connection.rollback();
        return NextResponse.json({
          message: "ظرفیت موجود است؛ ثبت‌نام عادی را ادامه دهید.",
          capacityAvailable: true
        }, { status: 409 });
      }

      const [duplicateUser] = await connection.query<RowDataPacket[]>(`
        SELECT id
        FROM waitlist_entries
        WHERE user_id=? AND tournament_id=? AND status IN ('WAITING','OFFERED')
        LIMIT 1
        FOR UPDATE
      `, [userId, tournament.id]);
      if (duplicateUser[0]) {
        await connection.rollback();
        return NextResponse.json({
          message: "شما قبلاً در صف انتظار این مسابقه هستید."
        }, { status: 409 });
      }

      for (const mobile of mobiles) {
        const [duplicates] = await connection.query<RowDataPacket[]>(`
          SELECT 1
          WHERE EXISTS (
            SELECT 1
            FROM registrations r
            JOIN registration_entries re ON re.registration_id=r.id
            LEFT JOIN players p ON p.id=re.player_id
            LEFT JOIN team_members tm ON tm.team_id=re.team_id
            LEFT JOIN players tp ON tp.id=tm.player_id
            WHERE r.tournament_id=?
              AND r.deleted_at IS NULL
              AND r.status NOT IN ('CANCELLED','REJECTED','EXPIRED','NO_SHOW')
              AND (p.mobile=? OR tp.mobile=?)
          )
          OR EXISTS (
            SELECT 1
            FROM waitlist_entries w
            WHERE w.tournament_id=?
              AND w.status IN ('WAITING','OFFERED')
              AND JSON_SEARCH(w.player_data,'one',?,NULL,'$[*].mobile') IS NOT NULL
          )
          LIMIT 1
        `, [tournament.id, mobile, mobile, tournament.id, mobile]);

        if (duplicates[0]) {
          await connection.rollback();
          return NextResponse.json({
            message: `شماره ${mobile} قبلاً در این مسابقه ثبت شده یا در صف انتظار است.`
          }, { status: 409 });
        }
      }

      const [positionRows] = await connection.query<PositionRow[]>(`
        SELECT COALESCE(MAX(position),0)+1 AS next_position
        FROM waitlist_entries
        WHERE tournament_id=?
        FOR UPDATE
      `, [tournament.id]);
      const position = Number(positionRows[0]?.next_position || 1);

      const [created] = await connection.execute<ResultSetHeader>(`
        INSERT INTO waitlist_entries(
          public_id,user_id,tournament_id,position,status,participant_type,
          player_data,team_title,existing_team_id,slots,amount,payment_method,
          created_at,updated_at
        ) VALUES(?,?,?,?, 'WAITING',?,?,?,?,?,?,?,NOW(),NOW())
      `, [
        newWaitlistPublicId(),
        userId,
        tournament.id,
        position,
        tournament.participant_type,
        JSON.stringify(players),
        teamTitle,
        existingTeamId,
        slots,
        Number(tournament.price) * slots,
        input.paymentMethod
      ]);

      await connection.commit();
      return NextResponse.json({
        ok: true,
        id: String(created.insertId),
        position
      }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات صف انتظار نامعتبر است.",
        errors: (error as { issues: unknown[] }).issues
      }, { status: 422 });
    }

    if (error instanceof Error && error.message === "PAYMENT_METHOD_DISABLED") {
      return NextResponse.json({ message: "این روش پرداخت غیرفعال است." }, { status: 409 });
    }

    if (error instanceof Error && error.message === "TEAM_MEMBER_MOBILE_REQUIRED") {
      return NextResponse.json({
        message: "همه اعضای تیم باید شماره موبایل معتبر داشته باشند."
      }, { status: 422 });
    }

    console.error("waitlist.create.failed", error);
    return NextResponse.json({ message: "ثبت در صف انتظار انجام نشد." }, { status: 500 });
  }
}
