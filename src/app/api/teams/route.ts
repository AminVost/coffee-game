import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { acquirePlayerMobileLocks, ensureUserPlayer, releasePlayerMobileLocks } from "@/lib/player-identity";

const schema = z.object({ title: z.string().trim().min(2).max(140) });

type TeamRow = RowDataPacket & {
  id: number;
  public_id: string;
  title: string;
  avatar_url: string | null;
  member_count: number;
  is_captain: number;
};


export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({ items: [{ id: "mock-team", publicId: "TURBO-26", title: "تیم توربو", memberCount: 2, isCaptain: true }] });
  }

  const rows = await queryRows<TeamRow[]>(`
    SELECT t.id,t.public_id,t.title,t.avatar_url,
           COUNT(DISTINCT all_members.player_id) AS member_count,
           MAX(CASE WHEN mine.player_id IS NOT NULL AND mine.is_captain=1 THEN 1 ELSE 0 END) AS is_captain
    FROM players p
    JOIN team_members mine ON mine.player_id=p.id
    JOIN teams t ON t.id=mine.team_id
    LEFT JOIN team_members all_members ON all_members.team_id=t.id
    WHERE p.user_id=?
    GROUP BY t.id
    ORDER BY t.updated_at DESC
  `, [auth.user.id]);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      publicId: row.public_id,
      title: row.title,
      avatarUrl: row.avatar_url,
      memberCount: Number(row.member_count),
      isCaptain: Boolean(row.is_captain)
    }))
  });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    if (env.dataMode === "mock") return NextResponse.json({ ok: true, item: { id: `mock-${Date.now()}`, publicId: randomUUID(), title: input.title, memberCount: 1, isCaptain: true } }, { status: 201 });

    const publicId = randomUUID();
    const connection = await db.getConnection();
    let locks: string[] = [];

    try {
      if (auth.user.mobile) locks = await acquirePlayerMobileLocks(connection, [auth.user.mobile]);
      await connection.beginTransaction();
      const playerId = await ensureUserPlayer(connection, {
        id: Number(auth.user.id),
        name: auth.user.name,
        mobile: auth.user.mobile || null
      });

      const [createdTeam] = await connection.execute<ResultSetHeader>(`
        INSERT INTO teams(public_id,title,created_by_id,created_at,updated_at)
        VALUES(?,?,?,NOW(),NOW())
      `, [publicId, input.title, auth.user.id]);
      await connection.execute(`
        INSERT INTO team_members(team_id,player_id,is_captain,joined_at)
        VALUES(?,?,1,NOW())
      `, [createdTeam.insertId, playerId]);
      await connection.commit();

      await writeAuditLog({
        actorUserId: auth.user.id,
        action: "team.created",
        entityType: "team",
        entityId: createdTeam.insertId,
        newData: { title: input.title, publicId },
        request
      });

      return NextResponse.json({
        ok: true,
        item: { id: String(createdTeam.insertId), publicId, title: input.title, memberCount: 1, isCaptain: true }
      }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, locks);
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "نام تیم معتبر نیست." }, { status: 422 });
    return NextResponse.json({ message: "ساخت تیم انجام نشد." }, { status: 500 });
  }
}
