import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { expireStaleRegistrationState } from "@/lib/registration-flow";
import { sendPaymentStatusSms } from "@/lib/sms";
import { getRuntimeSettings } from "@/lib/runtime-settings";
import { createNotification } from "@/lib/notifications";
import { offerNextWaitlistEntries } from "@/lib/waitlist";

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
  registration_status: string;
  tournament_id: number;
  registration_slots: number;
  tournament_capacity: number;
  buyer_user_id: number | null;
  contact_mobile: string | null;
  payer_name: string | null;
  payer_card_last4: string | null;
  tracking_code: string | null;
  paid_on: string | Date | null;
  submitted_at: Date | null;
  tournament_title: string;
};

type CountRow = RowDataPacket & { occupied_slots: number };

type NextStatus = "APPROVED" | "NEEDS_CORRECTION" | "REJECTED";

const finalPaymentStatuses = ["APPROVED", "REFUNDED", "CANCELLED", "REJECTED", "EXPIRED"];
const finalRegistrationStatuses = ["CANCELLED", "REJECTED", "EXPIRED"];

function paymentCanBeApproved(payment: PaymentRow) {
  if (payment.status !== "PENDING") return false;
  if (payment.method === "card_to_card") {
    return payment.registration_status === "PENDING_APPROVAL" && Boolean(payment.submitted_at);
  }
  if (["pos", "cash"].includes(payment.method)) {
    return payment.registration_status === "PENDING_PAYMENT";
  }
  return false;
}

function paymentCanRequestCorrection(payment: PaymentRow) {
  return payment.method === "card_to_card"
    && payment.status === "PENDING"
    && payment.registration_status === "PENDING_APPROVAL"
    && Boolean(payment.submitted_at);
}

function paymentCanBeRejected(payment: PaymentRow) {
  if (payment.status === "NEEDS_CORRECTION") {
    return payment.registration_status === "NEEDS_CORRECTION";
  }
  if (payment.status !== "PENDING") return false;
  if (payment.method === "card_to_card") {
    return payment.registration_status === "PENDING_APPROVAL" && Boolean(payment.submitted_at);
  }
  return ["pos", "cash"].includes(payment.method)
    && payment.registration_status === "PENDING_PAYMENT";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("payments.approve");
  if (auth.response) return auth.response;
  const actor = auth.user;
  if (!actor) {
    return NextResponse.json({ message: "دسترسی غیرمجاز است." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;
    const runtime = await getRuntimeSettings();
    const connection = await db.getConnection();

    let payment: PaymentRow | null = null;
    let nextStatus: NextStatus;

    try {
      await connection.beginTransaction();
      await expireStaleRegistrationState(connection);

      const [rows] = await connection.query<PaymentRow[]>(`
        SELECT
          p.id,p.status,p.method,p.registration_id,p.submitted_at,
          r.status AS registration_status,r.tournament_id,r.slots AS registration_slots,
          t.capacity AS tournament_capacity,
          COALESCE(p.user_id,r.buyer_user_id) AS buyer_user_id,
          r.contact_mobile,p.payer_name,p.payer_card_last4,p.tracking_code,p.paid_on,
          t.title AS tournament_title
        FROM payments p
        JOIN registrations r ON r.id=p.registration_id
        JOIN tournaments t ON t.id=r.tournament_id
        WHERE p.id=?
        LIMIT 1
        FOR UPDATE
      `, [id]);

      payment = rows[0] || null;
      if (!payment) {
        await connection.rollback();
        return NextResponse.json({ message: "پرداخت یافت نشد." }, { status: 404 });
      }

      if (
        finalPaymentStatuses.includes(payment.status)
        || finalRegistrationStatuses.includes(payment.registration_status)
      ) {
        await connection.rollback();
        return NextResponse.json({ message: "این پرداخت قبلاً نهایی شده است." }, { status: 409 });
      }

      if (input.action === "approve") {
        if (!paymentCanBeApproved(payment)) {
          await connection.rollback();
          return NextResponse.json({
            message: payment.status === "NEEDS_CORRECTION"
              ? "ابتدا کاربر باید اطلاعات اصلاح‌شده را دوباره ارسال کند."
              : "وضعیت این پرداخت برای تأیید آماده نیست."
          }, { status: 409 });
        }

        if (
          payment.method === "card_to_card"
          && !(payment.payer_name && payment.payer_card_last4 && payment.tracking_code && payment.paid_on)
        ) {
          await connection.rollback();
          return NextResponse.json({
            message: "اطلاعات انتقال بانکی کامل نیست و قابل تأیید نیست."
          }, { status: 422 });
        }

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
            +(
              SELECT COALESCE(SUM(slots),0)
              FROM registration_holds
              WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()
            )
            +(
              SELECT COALESCE(SUM(slots),0)
              FROM waitlist_entries
              WHERE tournament_id=? AND status='OFFERED' AND offer_expires_at>NOW()
            ) AS occupied_slots
        `, [
          payment.tournament_id,
          payment.registration_id,
          payment.tournament_id,
          payment.tournament_id
        ]);

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
          SET status='APPROVED',approved_by=?,approved_at=NOW(),rejected_reason=NULL,
              correction_expires_at=NULL,updated_at=NOW()
          WHERE id=?
        `, [actor.id, payment.id]);

        await connection.execute(`
          UPDATE registrations
          SET status='CONFIRMED',reserved_until=NULL,correction_expires_at=NULL,updated_at=NOW()
          WHERE id=?
        `, [payment.registration_id]);

        await connection.execute(`
          UPDATE registration_entries
          SET confirmed_at=COALESCE(confirmed_at,NOW())
          WHERE registration_id=?
        `, [payment.registration_id]);

        await createNotification({
          connection,
          userId: payment.buyer_user_id,
          type: "payment_approved",
          title: "پرداخت تأیید شد",
          body: `پرداخت ثبت‌نام مسابقه ${payment.tournament_title} تأیید شد.`,
          data: { paymentId: payment.id, registrationId: payment.registration_id }
        });

        nextStatus = "APPROVED";
      } else if (input.action === "request_correction") {
        if (!paymentCanRequestCorrection(payment)) {
          await connection.rollback();
          return NextResponse.json({
            message: "درخواست اصلاح فقط برای انتقال بانکی ارسال‌شده و در انتظار بررسی ممکن است."
          }, { status: 409 });
        }

        const expiresAt = new Date(Date.now() + runtime.registration.correctionHours * 3_600_000);

        await connection.execute(`
          UPDATE payments
          SET status='NEEDS_CORRECTION',approved_by=NULL,approved_at=NULL,rejected_reason=?,
              correction_expires_at=?,updated_at=NOW()
          WHERE id=?
        `, [input.reason, expiresAt, payment.id]);

        await connection.execute(`
          UPDATE registrations
          SET status='NEEDS_CORRECTION',correction_expires_at=?,updated_at=NOW()
          WHERE id=?
        `, [expiresAt, payment.registration_id]);

        await createNotification({
          connection,
          userId: payment.buyer_user_id,
          type: "payment_needs_correction",
          title: "اطلاعات پرداخت نیاز به اصلاح دارد",
          body: `پرداخت مسابقه ${payment.tournament_title} نیاز به اصلاح دارد: ${input.reason}`,
          data: {
            paymentId: payment.id,
            registrationId: payment.registration_id,
            correctionExpiresAt: expiresAt.toISOString()
          }
        });

        nextStatus = "NEEDS_CORRECTION";
      } else {
        if (!paymentCanBeRejected(payment)) {
          await connection.rollback();
          return NextResponse.json({
            message: "وضعیت این پرداخت اجازه رد نهایی را نمی‌دهد."
          }, { status: 409 });
        }

        await connection.execute(`
          UPDATE payments
          SET status='REJECTED',approved_by=NULL,approved_at=NULL,rejected_reason=?,
              correction_expires_at=NULL,updated_at=NOW()
          WHERE id=?
        `, [input.reason, payment.id]);

        await connection.execute(`
          UPDATE registrations
          SET status='REJECTED',reserved_until=NULL,correction_expires_at=NULL,updated_at=NOW()
          WHERE id=?
        `, [payment.registration_id]);

        await connection.execute(`
          UPDATE registration_entries SET confirmed_at=NULL WHERE registration_id=?
        `, [payment.registration_id]);

        await createNotification({
          connection,
          userId: payment.buyer_user_id,
          type: "payment_rejected",
          title: "پرداخت رد شد",
          body: `پرداخت مسابقه ${payment.tournament_title} رد شد: ${input.reason}`,
          data: { paymentId: payment.id, registrationId: payment.registration_id }
        });

        await offerNextWaitlistEntries(connection, payment.tournament_id);
        nextStatus = "REJECTED";
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (payment?.contact_mobile && nextStatus !== "NEEDS_CORRECTION") {
      try {
        await sendPaymentStatusSms({
          mobile: payment.contact_mobile,
          tournamentTitle: payment.tournament_title,
          status: nextStatus,
          reason: input.action === "reject" ? input.reason : null
        });
      } catch (error) {
        console.error("payment.status.sms.failed", error);
      }
    }

    await writeAuditLog({
      actorUserId: actor.id,
      action: input.action === "approve"
        ? "payment.approved"
        : input.action === "request_correction"
          ? "payment.correction_requested"
          : "payment.rejected",
      entityType: "payment",
      entityId: payment!.id,
      oldData: {
        paymentStatus: payment!.status,
        registrationStatus: payment!.registration_status
      },
      newData: {
        status: nextStatus,
        reason: input.action === "approve" ? null : input.reason
      },
      request
    });

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات عملیات پرداخت نامعتبر است." }, { status: 422 });
    }
    console.error("admin.payment.update.failed", error);
    return NextResponse.json({ message: "تغییر وضعیت پرداخت انجام نشد." }, { status: 500 });
  }
}
