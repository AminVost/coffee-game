import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { expireStaleRegistrationState } from "@/lib/registration-flow";

const schema = z.object({
  payerName: z.string().trim().min(2).max(120),
  cardLast4: z.string().regex(/^\d{4}$/),
  trackingCode: z.string().trim().min(4).max(64),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional()
});

type PaymentRow = RowDataPacket & {
  id: number;
  registration_id: number;
  method: string;
  amount: number;
  status: string;
  user_id: number | null;
  buyer_user_id: number | null;
  correction_expires_at: Date | null;
  registration_status: string;
};

type DuplicateRow = RowDataPacket & { id: number };

function isReasonablePaymentDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const oldest = new Date(now);
  oldest.setDate(oldest.getDate() - 30);
  const newest = new Date(now);
  newest.setDate(newest.getDate() + 1);
  return date >= oldest && date <= newest;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const currentUser = auth.user;
  if (!currentUser) {
    return NextResponse.json({ message: "ابتدا وارد حساب کاربری شوید." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;

    if (!isReasonablePaymentDate(input.paidOn)) {
      return NextResponse.json({ message: "تاریخ واریز نامعتبر است." }, { status: 422 });
    }

    const connection = await db.getConnection();
    let payment: PaymentRow | null = null;

    try {
      await connection.beginTransaction();
      await expireStaleRegistrationState(connection);

      const [rows] = await connection.query<PaymentRow[]>(`
        SELECT
          p.id,p.registration_id,p.method,p.amount,p.status,p.user_id,
          r.buyer_user_id,p.correction_expires_at,r.status AS registration_status
        FROM payments p
        JOIN registrations r ON r.id=p.registration_id
        WHERE (p.id=? OR p.public_id=?)
        LIMIT 1
        FOR UPDATE
      `, [/^\d+$/.test(id) ? Number(id) : 0, id]);

      payment = rows[0] || null;
      if (!payment) {
        await connection.rollback();
        return NextResponse.json({ message: "پرداخت یافت نشد." }, { status: 404 });
      }

      const ownsPayment = String(payment.user_id || payment.buyer_user_id || "") === currentUser.id;
      if (!ownsPayment) {
        await connection.rollback();
        return NextResponse.json({ message: "دسترسی غیرمجاز است." }, { status: 403 });
      }

      if (payment.method !== "card_to_card") {
        await connection.rollback();
        return NextResponse.json({
          message: "ثبت اطلاعات انتقال فقط برای روش کارت‌به‌کارت ممکن است."
        }, { status: 409 });
      }

      if (!["PENDING", "NEEDS_CORRECTION"].includes(payment.status)) {
        await connection.rollback();
        return NextResponse.json({
          message: "این پرداخت نهایی شده و قابل ویرایش نیست."
        }, { status: 409 });
      }

      if (!["PENDING_APPROVAL", "NEEDS_CORRECTION"].includes(payment.registration_status)) {
        await connection.rollback();
        return NextResponse.json({
          message: "وضعیت ثبت‌نام با ویرایش اطلاعات پرداخت سازگار نیست. صفحه را تازه‌سازی کنید."
        }, { status: 409 });
      }

      if (
        payment.status === "NEEDS_CORRECTION"
        && payment.correction_expires_at
        && new Date(payment.correction_expires_at).getTime() <= Date.now()
      ) {
        await connection.rollback();
        return NextResponse.json({
          message: "مهلت اصلاح اطلاعات پرداخت به پایان رسیده است."
        }, { status: 410 });
      }

      const [duplicates] = await connection.query<DuplicateRow[]>(`
        SELECT id
        FROM payments
        WHERE id<>?
          AND method='card_to_card'
          AND tracking_code=?
          AND payer_card_last4=?
          AND amount=?
          AND status NOT IN ('REJECTED','CANCELLED','EXPIRED')
        LIMIT 1
        FOR UPDATE
      `, [
        payment.id,
        input.trackingCode.trim(),
        input.cardLast4,
        payment.amount
      ]);

      if (duplicates.length) {
        await connection.rollback();
        return NextResponse.json({
          message: "این کد پیگیری با همین کارت و مبلغ قبلاً ثبت شده است."
        }, { status: 409 });
      }

      await connection.execute(`
        UPDATE payments
        SET payer_name=?,payer_card_last4=?,tracking_code=?,paid_on=?,paid_time=?,
            submitted_at=NOW(),status='PENDING',rejected_reason=NULL,
            correction_expires_at=NULL,approved_by=NULL,approved_at=NULL,updated_at=NOW()
        WHERE id=?
      `, [
        input.payerName.trim(),
        input.cardLast4,
        input.trackingCode.trim(),
        input.paidOn,
        input.paidTime || null,
        payment.id
      ]);

      await connection.execute(`
        UPDATE registrations
        SET status='PENDING_APPROVAL',correction_expires_at=NULL,updated_at=NOW()
        WHERE id=?
      `, [payment.registration_id]);

      await connection.execute(`
        INSERT INTO notifications(user_id,type,title,body,data,created_at)
        SELECT DISTINCT
          ur.user_id,
          'admin_payment_resubmitted',
          'اطلاعات پرداخت دوباره ارسال شد',
          'کاربر اطلاعات پرداخت را برای بررسی ارسال کرد.',
          ?,
          NOW()
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id=ur.role_id
        JOIN permissions perm ON perm.id=rp.permission_id
        JOIN users au ON au.id=ur.user_id
        WHERE perm.name IN ('payments.view','payments.approve')
          AND au.status='ACTIVE'
          AND au.deleted_at IS NULL
      `, [JSON.stringify({
        paymentId: payment.id,
        registrationId: payment.registration_id
      })]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: "payment.details_submitted",
      entityType: "payment",
      entityId: payment!.id,
      oldData: {
        paymentStatus: payment!.status,
        registrationStatus: payment!.registration_status
      },
      newData: {
        paymentStatus: "PENDING",
        registrationStatus: "PENDING_APPROVAL",
        payerName: input.payerName.trim(),
        cardLast4: input.cardLast4,
        trackingCode: input.trackingCode.trim(),
        paidOn: input.paidOn,
        paidTime: input.paidTime || null
      },
      request
    });

    return NextResponse.json({
      ok: true,
      status: "PENDING",
      submittedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        message: "اطلاعات انتقال بانکی نامعتبر است."
      }, { status: 422 });
    }
    console.error("account.payment.update.failed", error);
    return NextResponse.json({ message: "ثبت اطلاعات پرداخت انجام نشد." }, { status: 500 });
  }
}
