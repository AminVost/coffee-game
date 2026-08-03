import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { advanceTournament, recalculateRankingsForTournament } from "@/lib/tournament-engine";

const schema = z.object({
  status: z.enum(["accepted", "rejected", "resolved"]),
  resolution: z.string().trim().min(3).max(3000)
});

type DisputeRow = RowDataPacket & {
  id: number;
  match_id: number;
  tournament_id: number;
  submitted_by: number | null;
  status: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("matches.manage");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ message: "شناسه اعتراض نامعتبر است." }, { status: 400 });
    }

    const connection = await db.getConnection();
    let old: DisputeRow | null = null;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<DisputeRow[]>(`
        SELECT dispute.id,dispute.match_id,match_row.tournament_id,dispute.submitted_by,dispute.status
        FROM match_disputes dispute
        JOIN tournament_matches match_row ON match_row.id=dispute.match_id
        WHERE dispute.id=?
        LIMIT 1
        FOR UPDATE
      `, [id]);
      old = rows[0] || null;
      if (!old) {
        await connection.rollback();
        return NextResponse.json({ message: "اعتراض یافت نشد." }, { status: 404 });
      }
      if (old.status !== "open") {
        await connection.rollback();
        return NextResponse.json({ message: "این اعتراض قبلاً تعیین تکلیف شده است." }, { status: 409 });
      }

      await connection.execute(`
        UPDATE match_disputes
        SET status=?,resolution=?,resolved_by=?,resolved_at=NOW()
        WHERE id=?
      `, [input.status, input.resolution, auth.user.id, id]);

      if (old.submitted_by) {
        const acceptedHint = input.status === "accepted"
          ? " اعتراض پذیرفته شد و مدیر نتیجه بازی را جداگانه اصلاح می‌کند."
          : "";
        await createNotification({
          userId: old.submitted_by,
          type: "match_dispute_resolved",
          title: "پاسخ اعتراض ثبت شد",
          body: `${input.resolution}${acceptedHint}`,
          data: { disputeId: id, matchId: old.match_id, status: input.status },
          connection
        });
      }
      if (input.status !== "accepted") {
        const advancement = await advanceTournament(connection, old.tournament_id);
        if ((advancement as { completed?: boolean }).completed) {
          await recalculateRankingsForTournament(connection, old.tournament_id);
        }
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
      action: "match.dispute_resolved",
      entityType: "match_dispute",
      entityId: id,
      oldData: old || undefined,
      newData: input,
      request
    });
    return NextResponse.json({ ok: true, matchId: old?.match_id ? String(old.match_id) : null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "پاسخ اعتراض نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    return NextResponse.json({ message: "رسیدگی به اعتراض انجام نشد." }, { status: 500 });
  }
}
