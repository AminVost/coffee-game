import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";
import { env } from "@/lib/env";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3).max(500) })
]);

type PaymentRow = RowDataPacket & {
  id: number;
  status: string;
  registration_id: number;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("payments.approve");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;

    if (env.dataMode === "mock") {
      return NextResponse.json({ ok: true, status: input.action === "approve" ? "APPROVED" : "REJECTED" });
    }

    const rows = await queryRows<PaymentRow[]>(`
      SELECT id,status,registration_id FROM payments WHERE id=? LIMIT 1
    `, [id]);
    const payment = rows[0];
    if (!payment) return NextResponse.json({ message: "پرداخت یافت نشد." }, { status: 404 });
    if (["APPROVED", "REFUNDED", "CANCELLED"].includes(payment.status)) {
      return NextResponse.json({ message: "این پرداخت قبلاً نهایی شده است." }, { status: 409 });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (input.action === "approve") {
        await connection.execute(`
          UPDATE payments
          SET status='APPROVED',approved_by=?,approved_at=NOW(),rejected_reason=NULL,updated_at=NOW()
          WHERE id=?
        `, [auth.user.id, payment.id]);
        await connection.execute(`
          UPDATE registrations SET status='CONFIRMED',updated_at=NOW()
          WHERE id=? AND status NOT IN ('CANCELLED','REJECTED','WAITLISTED')
        `, [payment.registration_id]);
      } else {
        await connection.execute(`
          UPDATE payments
          SET status='REJECTED',approved_by=NULL,approved_at=NULL,rejected_reason=?,updated_at=NOW()
          WHERE id=?
        `, [input.reason, payment.id]);
        await connection.execute(`
          UPDATE registrations SET status='PENDING_PAYMENT',updated_at=NOW()
          WHERE id=? AND status='PENDING_APPROVAL'
        `, [payment.registration_id]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const status = input.action === "approve" ? "APPROVED" : "REJECTED";
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: input.action === "approve" ? "payment.approved" : "payment.rejected",
      entityType: "payment",
      entityId: payment.id,
      oldData: { status: payment.status },
      newData: { status, reason: input.action === "reject" ? input.reason : null },
      request
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات عملیات پرداخت نامعتبر است." }, { status: 422 });
    }
    return NextResponse.json({ message: "تغییر وضعیت پرداخت انجام نشد." }, { status: 500 });
  }
}
