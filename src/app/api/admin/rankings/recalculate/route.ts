import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { recalculateRankingsForTournament } from "@/lib/tournament-engine";

const schema = z.object({ tournamentId: z.coerce.number().int().positive() });

export async function POST(request: Request) {
  const auth = await authorize("matches.manage");
  if (auth.response) return auth.response;
  try {
    const input = schema.parse(await request.json());
    const connection = await db.getConnection();
    let result: { boards: number };
    try {
      await connection.beginTransaction();
      result = await recalculateRankingsForTournament(connection, input.tournamentId);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await writeAuditLog({ actorUserId: auth.user.id, action: "rankings.recalculated", entityType: "tournament", entityId: String(input.tournamentId), newData: result, request });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "مسابقه معتبر نیست." }, { status: 422 });
    return NextResponse.json({ message: "محاسبه رنکینگ انجام نشد." }, { status: 500 });
  }
}
