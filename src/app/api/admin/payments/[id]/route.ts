import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { expireStaleRegistrationState, expireStaleRegistrationStateNow } from "@/lib/registration-flow";
import { sendPaymentStatusSms } from "@/lib/sms";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("request_correction"),
    reason: z.string().trim().min(3).max(500)
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(500)
  })
]);

type PaymentRow = RowDataPacket & {
  id: number;
  status: string;
  method: string;
  registration_id: number;
  tournament_id: number;
  registration_slots: number;
  tournament_capacity: number;
  buyer_user_id: number | null;
  contact_mobile: string | null;
  payer_name: string | null;
  payer_card_last4: string | null;
  tracking_code: string | null;
  paid_on: string | Date | null;
  tournament_title: string;
};

type CountRow = RowDataPacket & {
  occupied_slots: number;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("payments.approve");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;

    await expireStaleRegistrationStateNow();

    const rows = await queryRows<PaymentRow[]>(`
      SELECT
        p.id,p.status,p.method,p.registration_id,r.tournament_id,
        r.slots AS registration_slots,t.capacity AS tournament_capacity,
        COALESCE(p.user_id,r.buyer_user_id) AS buyer_user_id,
        r.contact_mobile,p.payer_name,p.payer_card_last4,p.tracking_code,p.paid_on,
        t.title AS tournament_title
      FROM payments p
      JOIN registrations r ON r.id=p.registration_id
      JOIN tournaments t ON t.id=r.tournament_id
      WHERE p.id=?
      LIMIT 1
    `, [id]);
    const payment = rows[0];

    if (!payment) {
      return NextResponse.json({ message: "پرداخت یافت نشد." }, { status: 404 });
    }

    if (["APPROVED", "REFUNDED", "CANCELLED", "REJECTED", "EXPIRED"].includes(payment.status)) {
      return NextResponse.json({ message: "این پرداخت قبلاً نهایی شده است." }, { status: 409 });
    }

    if (input.action === "approve" && payment.method === "card_to_card") {
      const complete = Boolean(
        payment.payer_name
        && payment.payer_card_last4
        && payment.tracking_code
        && payment.paid_on
      );
      if (!complete) {
        return NextResponse.json({
          message: "اطلاعات انتقال بانکی کامل نیست و قابل تأیید نیست."
        }, { status: 422 });
      }
    }

    const connection = await db.getConnection();
    let nextStatus: "APPROVED" | "NEEDS_CORRECTION" | "REJECTED";

    try {
      await connection.beginTransaction();
      await expireStaleRegistrationState(connection);

      if (input.action === "approve") {
        await connection.query(`SELECT id FROM tournaments WHERE id=? FOR UPDATE`, [
          payment.tournament_id
        ]);

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
              WHERE tournament_id=? AND id<>? AND deleted_at IS NULL
            )
            +
            (
              SELECT COALESCE(SUM(slots),0)
              FROM registration_holds
              WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()
            ) AS occupied_slots
        `, [payment.tournament_id, payment.registration_id, payment.tournament_id]);

        if (
          Number(countRows[0]?.occupied_slots || 0) + Number(payment.registration_slots)
          > Number(payment.tournament_capacity)
        ) {
          await connection.rollback();
          return NextResponse.json({
            message: "ظرفیت مسابقه تکمیل شده و این پرداخت قابل تأیید نیست."
          }, { status: 409 });
        }

        await connection.execute(`
          UPDATE payments
          SET
            status='APPROVED',
            approved_by=?,
            approved_at=NOW(),
            rejected_reason=NULL,
            correction_expires_at=NULL,
            updated_at=NOW()
          WHERE id=?
        `, [auth.user.id, payment.id]);

        await connection.execute(`
          UPDATE registrations
          SET
            status='CONFIRMED',
            reserved_until=NULL,
            correction_expires_at=NULL,
            updated_at=NOW()
          WHERE id=?
        `, [payment.registration_id]);

        await connection.execute(`
          UPDATE registration_entries
          SET confirmed_at=COALESCE(confirmed_at,NOW())
          WHERE registration_id=?
        `, [payment.registration_id]);

        if (payment.buyer_user_id) {
          await connection.execute(`
            INSERT INTO notifications(user_id,type,title,body,data,created_at)
            VALUES(?,?,?,?,?,NOW())
          `, [
            payment.buyer_user_id,
            "payment_approved",
            "پرداخت تأیید شد",
            `پرداخت ثبت‌نام مسابقه ${payment.tournament_title} تأیید شد.`,
            JSON.stringify({
              paymentId: payment.id,
              registrationId: payment.registration_id
            })
          ]);
        }

        nextStatus = "APPROVED";
      } else if (input.action === "request_correction") {
        const correctionExpiresAt = new Date(
          Date.now() + env.paymentCorrectionHours * 60 * 60 * 1000
        );

        await connection.execute(`
          UPDATE payments
          SET
            status='NEEDS_CORRECTION',
            approved_by=NULL,
            approved_at=NULL,
            rejected_reason=?,
            correction_expires_at=?,
            updated_at=NOW()
          WHERE id=?
        `, [input.reason, correctionExpiresAt, payment.id]);

        await connection.execute(`
          UPDATE registrations
          SET
            status='NEEDS_CORRECTION',
            correction_expires_at=?,
            updated_at=NOW()
          WHERE id=?
        `, [correctionExpiresAt, payment.registration_id]);

        if (payment.buyer_user_id) {
          await connection.execute(`
            INSERT INTO notifications(user_id,type,title,body,data,created_at)
            VALUES(?,?,?,?,?,NOW())
          `, [
            payment.buyer_user_id,
            "payment_needs_correction",
            "اطلاعات پرداخت نیاز به اصلاح دارد",
            `پرداخت مسابقه ${payment.tournament_title} نیاز به اصلاح دارد: ${input.reason}`,
            JSON.stringify({
              paymentId: payment.id,
              registrationId: payment.registration_id,
              correctionExpiresAt: correctionExpiresAt.toISOString()
            })
          ]);
        }

        nextStatus = "NEEDS_CORRECTION";
      } else {
        await connection.execute(`
          UPDATE payments
          SET
            status='REJECTED',
            approved_by=NULL,
            approved_at=NULL,
            rejected_reason=?,
            correction_expires_at=NULL,
            updated_at=NOW()
          WHERE id=?
        `, [input.reason, payment.id]);

        await connection.execute(`
          UPDATE registrations
          SET
            status='REJECTED',
            reserved_until=NULL,
            correction_expires_at=NULL,
            updated_at=NOW()
          WHERE id=?
        `, [payment.registration_id]);

        await connection.execute(`
          UPDATE registration_entries SET confirmed_at=NULL WHERE registration_id=?
        `, [payment.registration_id]);

        if (payment.buyer_user_id) {
          await connection.execute(`
            INSERT INTO notifications(user_id,type,title,body,data,created_at)
            VALUES(?,?,?,?,?,NOW())
          `, [
            payment.buyer_user_id,
            "payment_rejected",
            "پرداخت رد شد",
            `پرداخت مسابقه ${payment.tournament_title} رد شد: ${input.reason}`,
            JSON.stringify({
              paymentId: payment.id,
              registrationId: payment.registration_id
            })
          ]);
        }

        nextStatus = "REJECTED";
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (payment.contact_mobile) {
      try {
        await sendPaymentStatusSms({
          mobile: payment.contact_mobile,
          tournamentTitle: payment.tournament_title,
          status: nextStatus === "APPROVED" ? "APPROVED" : "REJECTED",
          reason: input.action === "approve" ? null : input.reason
        });
      } catch (smsError) {
        console.error("payment.status.sms.failed", {
          paymentId: payment.id,
          mobile: payment.contact_mobile,
          error: smsError
        });
      }
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: input.action === "approve"
        ? "payment.approved"
        : input.action === "request_correction"
          ? "payment.correction_requested"
          : "payment.rejected",
      entityType: "payment",
      entityId: payment.id,
      oldData: { status: payment.status },
      newData: {
        status: nextStatus,
        reason: input.action === "approve" ? null : input.reason,
        method: payment.method
      },
      request
    });

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات عملیات پرداخت نامعتبر است."
      }, { status: 422 });
    }

    console.error("admin.payment.update.failed", error);
    return NextResponse.json({
      message: "تغییر وضعیت پرداخت انجام نشد."
    }, { status: 500 });
  }
}
