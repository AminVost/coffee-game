import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createHoldToken, parsePlayerData } from "@/lib/registration-flow";
import { getRuntimeSettings } from "@/lib/runtime-settings";
import { getAvailableSlots, offerNextWaitlistEntries } from "@/lib/waitlist";

const schema = z.object({
  action: z.enum(["accept", "cancel", "decline"]),
  offerToken: z.string().optional()
});

type WaitRow = RowDataPacket & {
  id: number;
  user_id: number;
  tournament_id: number;
  status: string;
  offer_token: string | null;
  offer_expires_at: Date | null;
  participant_type: "INDIVIDUAL" | "TEAM";
  player_data: unknown;
  team_title: string | null;
  existing_team_id: number | null;
  slots: number;
  amount: number;
};

type TeamMemberRow = RowDataPacket & {
  name: string;
  mobile: string | null;
};

async function validateExistingTeam(
  connection: import("mysql2/promise").PoolConnection,
  item: WaitRow,
  userId: number
) {
  if (!item.existing_team_id) return true;

  const [teams] = await connection.query<RowDataPacket[]>(`
    SELECT t.id
    FROM teams t
    JOIN team_members captain ON captain.team_id=t.id AND captain.is_captain=1
    JOIN players captain_player ON captain_player.id=captain.player_id
    WHERE t.id=? AND captain_player.user_id=?
    LIMIT 1
    FOR UPDATE
  `, [item.existing_team_id, userId]);
  if (!teams[0]) return false;

  const [members] = await connection.query<TeamMemberRow[]>(`
    SELECT p.name,p.mobile
    FROM team_members tm
    JOIN players p ON p.id=tm.player_id
    WHERE tm.team_id=?
    ORDER BY tm.is_captain DESC,tm.joined_at,tm.player_id
    FOR UPDATE
  `, [item.existing_team_id]);

  const snapshot = parsePlayerData(item.player_data).map((player) => player.mobile);
  const current = members.map((member) => member.mobile || "");
  return current.every((mobile) => /^09\d{9}$/.test(mobile))
    && JSON.stringify(snapshot) === JSON.stringify(current);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || !/^\d+$/.test(user.id)) {
    return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;
    const runtime = await getRuntimeSettings();
    const userId = Number(user.id);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<WaitRow[]>(`
        SELECT *
        FROM waitlist_entries
        WHERE id=? AND user_id=?
        LIMIT 1
        FOR UPDATE
      `, [id, userId]);
      const item = rows[0];

      if (!item) {
        await connection.rollback();
        return NextResponse.json({ message: "رکورد صف انتظار یافت نشد." }, { status: 404 });
      }

      if (input.action === "accept") {
        const offerExpired = !item.offer_expires_at
          || new Date(item.offer_expires_at).getTime() <= Date.now();
        if (
          item.status !== "OFFERED"
          || !item.offer_token
          || item.offer_token !== input.offerToken
          || offerExpired
        ) {
          if (item.status === "OFFERED") {
            await connection.execute(`
              UPDATE waitlist_entries
              SET status='EXPIRED',updated_at=NOW()
              WHERE id=?
            `, [item.id]);
          }
          await offerNextWaitlistEntries(connection, item.tournament_id);
          await connection.commit();
          return NextResponse.json({ message: "مهلت این پیشنهاد پایان یافته است." }, { status: 409 });
        }

        if (!(await validateExistingTeam(connection, item, userId))) {
          await connection.rollback();
          return NextResponse.json({
            message: "ترکیب یا مالکیت تیم تغییر کرده است؛ این پیشنهاد را لغو و دوباره وارد صف شوید."
          }, { status: 409 });
        }

        const available = await getAvailableSlots(connection, item.tournament_id, item.id);
        if (available < Number(item.slots)) {
          await connection.rollback();
          return NextResponse.json({
            message: "ظرفیت پیشنهادشده دیگر در دسترس نیست."
          }, { status: 409 });
        }

        const token = createHoldToken();
        const expiresAt = new Date(Date.now() + runtime.registration.holdMinutes * 60_000);
        await connection.execute(`
          INSERT INTO registration_holds(
            public_id,hold_token,tournament_id,user_id,contact_mobile,player_data,
            team_title,existing_team_id,participant_type,slots,amount,status,
            expires_at,created_at,updated_at
          )
          SELECT
            UUID(),?,?,w.user_id,u.mobile,w.player_data,w.team_title,
            w.existing_team_id,w.participant_type,w.slots,w.amount,'ACTIVE',?,NOW(),NOW()
          FROM waitlist_entries w
          JOIN users u ON u.id=w.user_id
          WHERE w.id=?
        `, [token, item.tournament_id, expiresAt, item.id]);

        await connection.execute(`
          UPDATE waitlist_entries
          SET status='CONVERTED',accepted_at=NOW(),converted_at=NOW(),updated_at=NOW()
          WHERE id=?
        `, [item.id]);
        await connection.commit();

        return NextResponse.json({
          ok: true,
          holdToken: token,
          expiresAt: expiresAt.toISOString()
        });
      }

      if (!["WAITING", "OFFERED"].includes(item.status)) {
        await connection.rollback();
        return NextResponse.json({ message: "این رکورد قابل تغییر نیست." }, { status: 409 });
      }

      await connection.execute(`
        UPDATE waitlist_entries
        SET status=?,cancelled_at=NOW(),updated_at=NOW()
        WHERE id=?
      `, [input.action === "decline" ? "DECLINED" : "CANCELLED", item.id]);
      await offerNextWaitlistEntries(connection, item.tournament_id);
      await connection.commit();
      return NextResponse.json({ ok: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 422 });
    }
    console.error("waitlist.update.failed", error);
    return NextResponse.json({ message: "عملیات صف انتظار انجام نشد." }, { status: 500 });
  }
}
