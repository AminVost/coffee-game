import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { hasPermission } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";

const schema = z.object({
  homeScore: z.number().int().min(0).max(999),
  awayScore: z.number().int().min(0).max(999),
  status: z.enum(["READY", "LIVE", "COMPLETED"]),
  notes: z.string().trim().max(1000).optional()
});

type MatchRow = RowDataPacket & {
  id: number;
  status: string;
  home_score: number | null;
  away_score: number | null;
  referee_user_id: number | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("results.submit");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;

    const rows = await queryRows<MatchRow[]>(`
      SELECT id,status,home_score,away_score,referee_user_id
      FROM tournament_matches WHERE id=? LIMIT 1
    `, [id]);
    const match = rows[0];
    if (!match) return NextResponse.json({ message: "بازی یافت نشد." }, { status: 404 });

    if (!hasPermission(auth.user, "matches.manage") && String(match.referee_user_id || "") !== auth.user.id) {
      return NextResponse.json({ message: "این بازی به شما تخصیص داده نشده است." }, { status: 403 });
    }

    const winnerSlot = input.status === "COMPLETED" && input.homeScore !== input.awayScore
      ? (input.homeScore > input.awayScore ? 1 : 2)
      : null;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(`
        UPDATE tournament_matches
        SET home_score=?,away_score=?,status=?,winner_slot=?,notes=?,
            started_at=IF(?='LIVE' AND started_at IS NULL,NOW(),started_at),
            completed_at=IF(?='COMPLETED',NOW(),NULL)
        WHERE id=?
      `, [
        input.homeScore,
        input.awayScore,
        input.status,
        winnerSlot,
        input.notes || null,
        input.status,
        input.status,
        id
      ]);
      await connection.execute(`UPDATE match_participants SET is_winner=0 WHERE match_id=?`, [id]);
      if (winnerSlot) {
        await connection.execute(`UPDATE match_participants SET is_winner=1 WHERE match_id=? AND slot=?`, [id, winnerSlot]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "match.result_updated",
      entityType: "tournament_match",
      entityId: id,
      oldData: { status: match.status, homeScore: match.home_score, awayScore: match.away_score },
      newData: input,
      request
    });

    return NextResponse.json({ ok: true, winnerSlot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "نتیجه واردشده نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    return NextResponse.json({ message: "ثبت نتیجه انجام نشد." }, { status: 500 });
  }
}
