import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";
import {
  maskCardLast4,
  maskMobile,
  paymentMethodTitle,
  paymentStatusTitle,
  registrationStatusTitle,
  expireStaleRegistrationStateNow
} from "@/lib/registration-flow";

type TrackingRow = RowDataPacket & {
  registration_id: number;
  tracking_code: string;
  tracking_token: string;
  registration_status: string;
  contact_mobile: string | null;
  slots: number;
  payable_amount: number;
  reserved_until: Date | null;
  correction_expires_at: Date | null;
  registration_updated_at: Date;
  tournament_title: string;
  tournament_slug: string;
  starts_at: Date;
  venue_title: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payer_card_last4: string | null;
  payment_submitted_at: Date | null;
  payment_rejected_reason: string | null;
  payment_correction_expires_at: Date | null;
  payment_updated_at: Date | null;
};

export type PublicRegistrationTracking = {
  trackingCode: string;
  tournamentTitle: string;
  tournamentSlug: string;
  startsAt: string;
  venue: string;
  registrationStatus: string;
  registrationStatusTitle: string;
  paymentStatus: string | null;
  paymentStatusTitle: string;
  paymentMethod: string | null;
  paymentMethodTitle: string;
  amount: number;
  slots: number;
  maskedMobile: string;
  maskedCard: string;
  submittedAt: string | null;
  rejectedReason: string | null;
  correctionExpiresAt: string | null;
  updatedAt: string;
  nextAction: string;
};

function nextAction(row: TrackingRow) {
  if (row.registration_status === "CONFIRMED") {
    return "ثبت‌نام قطعی است. در زمان اعلام‌شده در محل مسابقه حاضر شوید.";
  }
  if (row.registration_status === "CHECKED_IN") {
    return "حضور شما در مسابقه ثبت شده است.";
  }
  if (row.registration_status === "PENDING_APPROVAL") {
    return "اطلاعات پرداخت ارسال شده است؛ منتظر بررسی مدیر باشید.";
  }
  if (row.registration_status === "PENDING_PAYMENT") {
    return "برای نهایی‌شدن ثبت‌نام، پرداخت حضوری را در مهلت اعلام‌شده انجام دهید.";
  }
  if (row.registration_status === "NEEDS_CORRECTION") {
    return "اطلاعات پرداخت نیاز به اصلاح دارد. با همان شماره موبایل وارد حساب شوید و اطلاعات را اصلاح کنید.";
  }
  if (row.registration_status === "REJECTED") {
    return "ثبت‌نام رد شده است. برای پیگیری با مجموعه تماس بگیرید.";
  }
  if (row.registration_status === "EXPIRED") {
    return "مهلت این ثبت‌نام به پایان رسیده و ظرفیت آزاد شده است.";
  }
  if (row.registration_status === "WAITLISTED") {
    return "در صورت آزادشدن ظرفیت با شما تماس گرفته می‌شود.";
  }
  if (row.registration_status === "CANCELLED") {
    return "ثبت‌نام لغو شده است.";
  }
  return "آخرین وضعیت در همین صفحه نمایش داده می‌شود.";
}

export async function findRegistrationTracking(tokenOrCode: string): Promise<PublicRegistrationTracking | null> {
  await expireStaleRegistrationStateNow();

  const rows = await queryRows<TrackingRow[]>(`
    SELECT
      r.id AS registration_id,
      r.tracking_code,
      r.tracking_token,
      r.status AS registration_status,
      r.contact_mobile,
      r.slots,
      r.payable_amount,
      r.reserved_until,
      r.correction_expires_at,
      r.updated_at AS registration_updated_at,
      t.title AS tournament_title,
      t.slug AS tournament_slug,
      t.starts_at,
      v.title AS venue_title,
      p.method AS payment_method,
      p.status AS payment_status,
      p.payer_card_last4,
      p.submitted_at AS payment_submitted_at,
      p.rejected_reason AS payment_rejected_reason,
      p.correction_expires_at AS payment_correction_expires_at,
      p.updated_at AS payment_updated_at
    FROM registrations r
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN venues v ON v.id=t.venue_id
    LEFT JOIN payments p ON p.registration_id=r.id
    WHERE r.tracking_token=? OR r.tracking_code=?
    ORDER BY p.id DESC
    LIMIT 1
  `, [tokenOrCode, tokenOrCode.toUpperCase()]);

  const row = rows[0];
  if (!row) return null;

  const correctionExpiry = row.payment_correction_expires_at || row.correction_expires_at;
  const updatedAt = row.payment_updated_at && row.payment_updated_at > row.registration_updated_at
    ? row.payment_updated_at
    : row.registration_updated_at;

  return {
    trackingCode: row.tracking_code,
    tournamentTitle: row.tournament_title,
    tournamentSlug: row.tournament_slug,
    startsAt: new Date(row.starts_at).toISOString(),
    venue: row.venue_title || "محل برگزاری متعاقباً اعلام می‌شود",
    registrationStatus: row.registration_status,
    registrationStatusTitle: registrationStatusTitle(row.registration_status),
    paymentStatus: row.payment_status,
    paymentStatusTitle: row.payment_status
      ? paymentStatusTitle(row.payment_status, row.payment_method || undefined)
      : "پرداختی ثبت نشده",
    paymentMethod: row.payment_method,
    paymentMethodTitle: row.payment_method
      ? paymentMethodTitle(row.payment_method)
      : "—",
    amount: Number(row.payable_amount),
    slots: Number(row.slots),
    maskedMobile: maskMobile(row.contact_mobile),
    maskedCard: maskCardLast4(row.payer_card_last4),
    submittedAt: row.payment_submitted_at
      ? new Date(row.payment_submitted_at).toISOString()
      : null,
    rejectedReason: row.payment_rejected_reason,
    correctionExpiresAt: correctionExpiry
      ? new Date(correctionExpiry).toISOString()
      : null,
    updatedAt: new Date(updatedAt).toISOString(),
    nextAction: nextAction(row)
  };
}
