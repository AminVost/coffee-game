import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  expireStaleRegistrationState,
  parsePlayerData
} from "@/lib/registration-flow";

type HoldRow = RowDataPacket & {
  id: number;
  hold_token: string;
  tournament_id: number;
  user_id: number;
  contact_mobile: string;
  player_data: unknown;
  team_title: string | null;
  participant_type: "INDIVIDUAL" | "TEAM";
  slots: number;
  amount: number;
  status: string;
  expires_at: Date;
  tournament_title: string;
};

async function loadOwnedHold(token: string, userId: number) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await expireStaleRegistrationState(connection);
    const [rows] = await connection.query<HoldRow[]>(`
      SELECT rh.*,t.title AS tournament_title
      FROM registration_holds rh
      JOIN tournaments t ON t.id=rh.tournament_id
      WHERE rh.hold_token=? AND rh.user_id=?
      LIMIT 1
      FOR UPDATE
    `, [token, userId]);
    await connection.commit();
    return rows[0] || null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getSession();
  if (!user || !/^\d+$/.test(user.id)) {
    return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  }

  const { token } = await params;
  const hold = await loadOwnedHold(token, Number(user.id));
  if (!hold) return NextResponse.json({ message: "رزرو موقت یافت نشد." }, { status: 404 });

  return NextResponse.json({
    holdToken: hold.hold_token,
    tournamentId: String(hold.tournament_id),
    tournamentTitle: hold.tournament_title,
    contactMobile: hold.contact_mobile,
    players: parsePlayerData(hold.player_data),
    teamTitle: hold.team_title,
    participantType: hold.participant_type,
    slots: Number(hold.slots),
    amount: Number(hold.amount),
    status: hold.status,
    expiresAt: new Date(hold.expires_at).toISOString()
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getSession();
  if (!user || !/^\d+$/.test(user.id)) {
    return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  }


  const { token } = await params;
  const result = await db.execute(`
    UPDATE registration_holds
    SET status='CANCELLED',updated_at=NOW()
    WHERE hold_token=? AND user_id=? AND status='ACTIVE'
  `, [token, Number(user.id)]);

  if (!result[0] || !("affectedRows" in result[0]) || Number(result[0].affectedRows) !== 1) {
    return NextResponse.json({ message: "رزرو فعال یافت نشد." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
