import { randomBytes } from "crypto";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";

export type RegistrationPlayerInput = {
  name: string;
  mobile: string;
};

export function createTrackingCode() {
  return `CGS-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function createTrackingToken() {
  return randomBytes(32).toString("hex");
}

export function createHoldToken() {
  return randomBytes(32).toString("hex");
}

export function maskMobile(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length < 7) return "***";
  return `${value.slice(0, 2)}*****${value.slice(-4)}`;
}

export function maskCardLast4(value: string | null | undefined) {
  return value ? `**** ${value}` : "—";
}

export function registrationStatusTitle(status: string) {
  const titles: Record<string, string> = {
    RESERVED: "رزروشده",
    PENDING_PAYMENT: "در انتظار پرداخت حضوری",
    PENDING_APPROVAL: "در انتظار بررسی پرداخت",
    NEEDS_CORRECTION: "نیازمند اصلاح اطلاعات پرداخت",
    CONFIRMED: "ثبت‌نام قطعی",
    WAITLISTED: "لیست انتظار",
    CHECKED_IN: "حاضر در مسابقه",
    NO_SHOW: "عدم حضور",
    CANCELLED: "لغوشده",
    REJECTED: "ردشده",
    EXPIRED: "منقضی‌شده"
  };
  return titles[status] || status;
}

export function paymentStatusTitle(status: string, method?: string) {
  if (status === "PENDING" && ["pos", "cash"].includes(method || "")) {
    return "در انتظار پرداخت حضوری";
  }

  const titles: Record<string, string> = {
    PENDING: "در انتظار بررسی",
    NEEDS_CORRECTION: "نیازمند اصلاح",
    APPROVED: "تأییدشده",
    REJECTED: "رد نهایی",
    EXPIRED: "منقضی‌شده",
    CANCELLED: "لغوشده",
    REFUNDED: "بازگشت وجه"
  };
  return titles[status] || status;
}

export function paymentMethodTitle(method: string) {
  const titles: Record<string, string> = {
    card_to_card: "کارت‌به‌کارت / انتقال بانکی",
    pos: "کارتخوان حضوری",
    cash: "پرداخت نقدی حضوری",
    receipt: "انتقال بانکی قدیمی",
    online: "درگاه قدیمی"
  };
  return titles[method] || method;
}


export function parsePlayerData(value: unknown): RegistrationPlayerInput[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is RegistrationPlayerInput => Boolean(
      item && typeof item === "object"
      && typeof (item as RegistrationPlayerInput).name === "string"
      && typeof (item as RegistrationPlayerInput).mobile === "string"
    ));
  }

  if (typeof value === "string") {
    try {
      return parsePlayerData(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return [];
}

export async function expireStaleRegistrationState(connection: PoolConnection) {
  await connection.execute(`
    UPDATE registration_holds
    SET status='EXPIRED',updated_at=NOW()
    WHERE status='ACTIVE' AND expires_at<=NOW()
  `);

  await connection.execute(`
    UPDATE payments p
    JOIN registrations r ON r.id=p.registration_id
    SET
      p.status='EXPIRED',
      p.updated_at=NOW(),
      r.status='EXPIRED',
      r.updated_at=NOW()
    WHERE p.status='NEEDS_CORRECTION'
      AND p.correction_expires_at IS NOT NULL
      AND p.correction_expires_at<=NOW()
      AND r.status='NEEDS_CORRECTION'
  `);

  await connection.execute(`
    UPDATE payments p
    JOIN registrations r ON r.id=p.registration_id
    SET
      p.status='EXPIRED',
      p.updated_at=NOW(),
      r.status='EXPIRED',
      r.updated_at=NOW()
    WHERE p.status='PENDING'
      AND p.method IN ('pos','cash')
      AND r.status='PENDING_PAYMENT'
      AND r.reserved_until IS NOT NULL
      AND r.reserved_until<=NOW()
  `);
}


export async function expireStaleRegistrationStateNow() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await expireStaleRegistrationState(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
