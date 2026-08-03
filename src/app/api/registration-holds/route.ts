import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/runtime-settings";
import {
  acquirePlayerMobileLocks,
  releasePlayerMobileLocks
} from "@/lib/player-identity";
import {
  createHoldToken,
  expireStaleRegistrationState
} from "@/lib/registration-flow";
import { getRequestIp, getRequestUserAgent } from "@/lib/request-context";

const playerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().regex(/^09\d{9}$/)
});

const schema = z.object({
  tournamentId: z.string().regex(/^\d+$/),
  players: z.array(playerSchema).min(1).max(20),
  teamTitle: z.string().trim().min(2).max(140).optional(),
  teamId: z.coerce.number().int().positive().optional()
});

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  capacity: number;
  price: number;
  allow_multi_slot: number;
  participant_type: "INDIVIDUAL" | "TEAM";
  team_size: number;
  status: string;
  registration_starts_at: Date | null;
  registration_ends_at: Date | null;
  starts_at: Date;
  waitlist_mode: string;
};

type ExistingHoldRow = RowDataPacket & {
  id: number;
  public_id: string;
  hold_token: string;
};

type CountRow = RowDataPacket & {
  occupied_slots: number;
};

type DuplicateRow = RowDataPacket & {
  mobile: string;
};

type RateRow = RowDataPacket & {
  hourly_count: number;
};

type ActiveWaitlistRow = RowDataPacket & {
  status: "WAITING" | "OFFERED";
};

type OwnedTeamRow = RowDataPacket & { id: number; title: string };
type OwnedTeamMemberRow = RowDataPacket & { player_id: number; name: string; mobile: string | null };

async function loadOwnedTeam(
  connection: import("mysql2/promise").PoolConnection,
  teamId: number,
  userId: number,
  lock = false
) {
  const [teams] = await connection.query<OwnedTeamRow[]>(`
    SELECT t.id,t.title
    FROM teams t
    JOIN team_members captain ON captain.team_id=t.id AND captain.is_captain=1
    JOIN players captain_player ON captain_player.id=captain.player_id
    WHERE t.id=? AND captain_player.user_id=?
    LIMIT 1 ${lock ? "FOR UPDATE" : ""}
  `, [teamId, userId]);
  if (!teams[0]) return null;
  const [members] = await connection.query<OwnedTeamMemberRow[]>(`
    SELECT tm.player_id,p.name,p.mobile
    FROM team_members tm
    JOIN players p ON p.id=tm.player_id
    WHERE tm.team_id=?
    ORDER BY tm.is_captain DESC,tm.joined_at,tm.player_id
    ${lock ? "FOR UPDATE" : ""}
  `, [teamId]);
  if (members.some((member) => !member.mobile || !/^09\d{9}$/.test(member.mobile))) {
    throw new Error("TEAM_MEMBER_MOBILE_REQUIRED");
  }
  return { team: teams[0], members };
}

function normalizePlayers(players: z.infer<typeof playerSchema>[]) {
  return players.map((player) => ({
    name: player.name.trim(),
    mobile: player.mobile.trim()
  }));
}

function validatePlayerCount(tournament: TournamentRow, playersLength: number) {
  if (tournament.participant_type === "TEAM") {
    if (playersLength !== tournament.team_size) {
      return {
        error: `برای ثبت این تیم باید دقیقاً ${tournament.team_size.toLocaleString("fa-IR")} بازیکن وارد شود.`,
        slots: 0
      };
    }
    return { error: null, slots: 1 };
  }

  if (playersLength > 1 && !tournament.allow_multi_slot) {
    return { error: "ثبت چند شرکت‌کننده برای این مسابقه فعال نیست.", slots: 0 };
  }

  return { error: null, slots: playersLength };
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getSession();

    if (!user || !/^\d+$/.test(user.id) || !user.mobile) {
      return NextResponse.json({
        message: "برای رزرو ظرفیت ابتدا شماره موبایل خود را تایید کنید.",
        requiresOtp: true
      }, { status: 401 });
    }

    let players = normalizePlayers(input.players);
    let selectedTeamTitle = input.teamTitle?.trim() || null;
    const userId = Number(user.id);
    const connection = await db.getConnection();
    let mobileLocks: string[] = [];

    try {
      if (input.teamId) {
        const ownedTeam = await loadOwnedTeam(connection, input.teamId, userId);
        if (!ownedTeam) {
          return NextResponse.json({ message: "فقط کاپیتان می‌تواند این تیم را ثبت‌نام کند." }, { status: 403 });
        }
        players = ownedTeam.members.map((member) => ({ name: member.name, mobile: member.mobile! }));
        selectedTeamTitle = ownedTeam.team.title;
      }
      const mobiles = players.map((player) => player.mobile);
      if (new Set(mobiles).size !== mobiles.length) {
        return NextResponse.json({ message: "هر شماره موبایل را فقط یک‌بار وارد کنید." }, { status: 409 });
      }

      const runtime = await getRuntimeSettings();
      mobileLocks = await acquirePlayerMobileLocks(connection, mobiles);
      await connection.beginTransaction();
      await expireStaleRegistrationState(connection);

      const [tournaments] = await connection.query<TournamentRow[]>(`
        SELECT id,title,capacity,price,allow_multi_slot,participant_type,team_size,status,registration_starts_at,registration_ends_at,starts_at,waitlist_mode
        FROM tournaments
        WHERE id=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [input.tournamentId]);

      const tournament = tournaments[0];
      if (!tournament) {
        await connection.rollback();
        return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
      }

      const now = Date.now();
      const registrationStarted = !tournament.registration_starts_at || new Date(tournament.registration_starts_at).getTime() <= now;
      const registrationNotEnded = !tournament.registration_ends_at || new Date(tournament.registration_ends_at).getTime() > now;
      const tournamentNotStarted = new Date(tournament.starts_at).getTime() > now;
      if (tournament.status !== "REGISTRATION_OPEN" || !registrationStarted || !registrationNotEnded || !tournamentNotStarted) {
        await connection.rollback();
        return NextResponse.json({ message: "ثبت‌نام این مسابقه در بازه زمانی فعلی فعال نیست." }, { status: 409 });
      }

      if (input.teamId) {
        if (tournament.participant_type !== "TEAM") {
          await connection.rollback();
          return NextResponse.json({ message: "برای مسابقه انفرادی نمی‌توان تیم انتخاب کرد." }, { status: 422 });
        }
        const lockedTeam = await loadOwnedTeam(connection, input.teamId, userId, true);
        if (!lockedTeam) {
          await connection.rollback();
          return NextResponse.json({ message: "دسترسی ثبت‌نام این تیم تغییر کرده است." }, { status: 409 });
        }
        const lockedPlayers = lockedTeam.members.map((member) => ({ name: member.name, mobile: member.mobile! }));
        if (JSON.stringify(lockedPlayers.map((item) => item.mobile)) !== JSON.stringify(players.map((item) => item.mobile))) {
          await connection.rollback();
          return NextResponse.json({ message: "ترکیب تیم تغییر کرده است؛ فرم را تازه‌سازی و دوباره تلاش کنید." }, { status: 409 });
        }
        players = lockedPlayers;
        selectedTeamTitle = lockedTeam.team.title;
      }

      const countValidation = validatePlayerCount(tournament, players.length);
      if (countValidation.error) {
        await connection.rollback();
        return NextResponse.json({ message: countValidation.error }, { status: 422 });
      }

      const requestedSlots = countValidation.slots;
      const requestIp = getRequestIp(request);
      const userAgent = getRequestUserAgent(request);

      const [existingRows] = await connection.query<ExistingHoldRow[]>(`
        SELECT id,public_id,hold_token
        FROM registration_holds
        WHERE tournament_id=?
          AND user_id=?
          AND status='ACTIVE'
          AND expires_at>NOW()
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `, [tournament.id, userId]);
      const existingHold = existingRows[0] || null;

      if (!existingHold) {
        const [activeWaitlistRows] = await connection.query<ActiveWaitlistRow[]>(`
          SELECT status
          FROM waitlist_entries
          WHERE user_id=?
            AND tournament_id=?
            AND status IN ('WAITING','OFFERED')
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `, [userId, tournament.id]);
        const activeWaitlist = activeWaitlistRows[0];
        if (activeWaitlist) {
          await connection.rollback();
          return NextResponse.json({
            message: activeWaitlist.status === "OFFERED"
              ? "برای شما ظرفیت پیشنهاد شده است؛ از بخش صف انتظار حساب کاربری آن را بپذیرید."
              : "شما قبلاً در صف انتظار این مسابقه هستید.",
            waitlistActive: true
          }, { status: 409 });
        }
      }

      if (!existingHold && requestIp) {
        const [rateRows] = await connection.query<RateRow[]>(`
          SELECT COUNT(*) AS hourly_count
          FROM registration_holds
          WHERE request_ip=?
            AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)
        `, [requestIp]);

        if (Number(rateRows[0]?.hourly_count || 0) >= 8) {
          await connection.rollback();
          return NextResponse.json({
            message: "تعداد درخواست‌های رزرو از این دستگاه بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
          }, { status: 429 });
        }
      }

      for (const mobile of mobiles) {
        const [duplicateRows] = await connection.query<DuplicateRow[]>(`
          SELECT ? AS mobile
          WHERE EXISTS (
            SELECT 1
            FROM registrations r
            JOIN registration_entries re ON re.registration_id=r.id
            LEFT JOIN players p ON p.id=re.player_id
            LEFT JOIN team_members tm ON tm.team_id=re.team_id
            LEFT JOIN players tp ON tp.id=tm.player_id
            WHERE r.tournament_id=?
              AND r.deleted_at IS NULL
              AND (
                r.status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN')
                OR (r.status='PENDING_PAYMENT' AND (r.reserved_until IS NULL OR r.reserved_until>NOW()))
                OR (r.status='NEEDS_CORRECTION' AND r.correction_expires_at>NOW())
              )
              AND (p.mobile=? OR tp.mobile=?)
          )
          OR EXISTS (
            SELECT 1
            FROM registration_holds rh
            WHERE rh.tournament_id=?
              AND rh.status='ACTIVE'
              AND rh.expires_at>NOW()
              AND rh.id<>?
              AND JSON_SEARCH(rh.player_data,'one',?,NULL,'$[*].mobile') IS NOT NULL
          )
          OR EXISTS (
            SELECT 1
            FROM waitlist_entries w
            WHERE w.tournament_id=?
              AND w.status IN ('WAITING','OFFERED')
              AND JSON_SEARCH(w.player_data,'one',?,NULL,'$[*].mobile') IS NOT NULL
          )
          LIMIT 1
        `, [
          mobile,
          tournament.id,
          mobile,
          mobile,
          tournament.id,
          existingHold?.id || 0,
          mobile,
          tournament.id,
          mobile
        ]);

        if (duplicateRows.length) {
          await connection.rollback();
          return NextResponse.json({
            message: `شماره ${mobile} قبلاً برای این مسابقه ثبت یا رزرو شده است.`
          }, { status: 409 });
        }
      }

      const [countRows] = await connection.query<CountRow[]>(`
        SELECT
          (
            SELECT COALESCE(SUM(
              CASE
                WHEN status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN slots
                WHEN status='PENDING_PAYMENT' AND (reserved_until IS NULL OR reserved_until>NOW()) THEN slots
                WHEN status='NEEDS_CORRECTION' AND correction_expires_at>NOW() THEN slots
                ELSE 0
              END
            ),0)
            FROM registrations
            WHERE tournament_id=? AND deleted_at IS NULL
          )
          +
          (
            SELECT COALESCE(SUM(slots),0)
            FROM registration_holds
            WHERE tournament_id=?
              AND status='ACTIVE'
              AND expires_at>NOW()
              AND id<>?
          )
          +
          (
            SELECT COALESCE(SUM(slots),0)
            FROM waitlist_entries
            WHERE tournament_id=? AND status='OFFERED' AND offer_expires_at>NOW()
          ) AS occupied_slots
      `, [tournament.id, tournament.id, existingHold?.id || 0, tournament.id]);

      const occupiedSlots = Number(countRows[0]?.occupied_slots || 0);
      if (occupiedSlots + requestedSlots > Number(tournament.capacity)) {
        await connection.rollback();
        return NextResponse.json({
          message: "ظرفیت مسابقه تکمیل شده است.",
          waitlistAvailable: tournament.waitlist_mode !== "disabled",
          tournamentId: String(tournament.id)
        }, { status: 409 });
      }

      const expiresAt = new Date(Date.now() + runtime.registration.holdMinutes * 60_000);
      const amount = Number(tournament.price) * requestedSlots;
      const playerJson = JSON.stringify(players);
      let holdToken: string;
      let resumed = false;

      if (existingHold) {
        holdToken = existingHold.hold_token;
        resumed = true;
        await connection.execute(`
          UPDATE registration_holds
          SET
            contact_mobile=?,
            player_data=?,
            team_title=?,
            existing_team_id=?,
            participant_type=?,
            slots=?,
            amount=?,
            expires_at=?,
            request_ip=?,
            user_agent=?,
            updated_at=NOW()
          WHERE id=?
        `, [
          user.mobile,
          playerJson,
          selectedTeamTitle,
          input.teamId || null,
          tournament.participant_type,
          requestedSlots,
          amount,
          expiresAt,
          requestIp,
          userAgent,
          existingHold.id
        ]);
      } else {
        holdToken = createHoldToken();
        await connection.execute<ResultSetHeader>(`
          INSERT INTO registration_holds(
            public_id,hold_token,tournament_id,user_id,contact_mobile,
            player_data,team_title,existing_team_id,participant_type,slots,amount,status,
            expires_at,request_ip,user_agent,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?,NOW(),NOW())
        `, [
          randomUUID(),
          holdToken,
          tournament.id,
          userId,
          user.mobile,
          playerJson,
          selectedTeamTitle,
          input.teamId || null,
          tournament.participant_type,
          requestedSlots,
          amount,
          expiresAt,
          requestIp,
          userAgent
        ]);
      }

      const firstPlayerName = players[0]?.name;
      if (firstPlayerName) {
        await connection.execute(`
          UPDATE users
          SET name=?,updated_at=NOW()
          WHERE id=? AND (name LIKE 'کاربر %' OR name='کاربر پیامکی')
        `, [firstPlayerName, userId]);
      }

      await connection.commit();

      return NextResponse.json({
        ok: true,
        holdToken,
        expiresAt: expiresAt.toISOString(),
        holdMinutes: runtime.registration.holdMinutes,
        amount,
        contactMobile: user.mobile,
        resumed
      }, { status: existingHold ? 200 : 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, mobileLocks);
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات اولیه ثبت‌نام نامعتبر است.",
        errors: error.issues
      }, { status: 422 });
    }

    if (error instanceof Error && error.message === "PLAYER_IDENTITY_LOCK_TIMEOUT") {
      return NextResponse.json({
        message: "درخواست دیگری برای این شماره در حال پردازش است. دوباره تلاش کنید."
      }, { status: 409 });
    }

    if (error instanceof Error && error.message === "TEAM_MEMBER_MOBILE_REQUIRED") {
      return NextResponse.json({
        message: "همه اعضای تیم باید شماره موبایل معتبر داشته باشند."
      }, { status: 422 });
    }

    console.error("registration.hold.create.failed", error);
    return NextResponse.json({ message: "رزرو موقت ظرفیت انجام نشد." }, { status: 500 });
  }
}
