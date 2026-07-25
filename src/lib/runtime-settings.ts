import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";

export type PaymentRuntimeSettings = { cardToCard: boolean; pos: boolean; cash: boolean; partial: boolean };
export type NotificationRuntimeSettings = { inApp: boolean; email: boolean; sms: "disabled" | "optional" | "required" };
export type AuthRuntimeSettings = { admin2fa: "optional" | "required"; sessionDays: number };
export type RegistrationRuntimeSettings = { holdMinutes: number; correctionHours: number; waitlistOfferMinutes: number };
export type OtpRuntimeSettings = { ttlMinutes: number; cooldownSeconds: number; hourlyLimit: number; ipHourlyLimit: number; maxAttempts: number };

type SettingRow = RowDataPacket & { key: string; value: unknown };

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    if (typeof value === "string") return JSON.parse(value) as T;
    return (value as T) ?? fallback;
  } catch { return fallback; }
}
function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function getRuntimeSettings(connection?: PoolConnection) {
  const sql = `
    SELECT \`key\`,value FROM app_settings
    WHERE \`key\` IN ('auth.settings','payment.settings','notification.settings','registration.settings','otp.settings')
  `;
  const rows = connection
    ? (await connection.query<SettingRow[]>(sql))[0]
    : await queryRows<SettingRow[]>(sql);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const auth = parseJson<Record<string, unknown>>(values.get("auth.settings"), {});
  const payment = parseJson<Record<string, unknown>>(values.get("payment.settings"), {});
  const notification = parseJson<Record<string, unknown>>(values.get("notification.settings"), {});
  const registration = parseJson<Record<string, unknown>>(values.get("registration.settings"), {});
  const otp = parseJson<Record<string, unknown>>(values.get("otp.settings"), {});

  return {
    auth: {
      admin2fa: auth.admin2fa === "required" ? "required" : "optional",
      sessionDays: boundedInt(auth.sessionDays, env.sessionDays, 1, 90)
    } satisfies AuthRuntimeSettings,
    payment: {
      cardToCard: payment.receipt !== false,
      pos: payment.pos !== false,
      cash: payment.cash !== false,
      partial: payment.partial === true
    } satisfies PaymentRuntimeSettings,
    notification: {
      inApp: notification.inApp !== false,
      email: notification.email === true,
      sms: notification.sms === "required" || notification.sms === "optional" ? notification.sms : "disabled"
    } satisfies NotificationRuntimeSettings,
    registration: {
      holdMinutes: boundedInt(registration.holdMinutes, 15, 5, 120),
      correctionHours: boundedInt(registration.correctionHours, 24, 1, 168),
      waitlistOfferMinutes: boundedInt(registration.waitlistOfferMinutes, 30, 5, 1440)
    } satisfies RegistrationRuntimeSettings,
    otp: {
      ttlMinutes: boundedInt(otp.ttlMinutes, env.smsOtpTtlMinutes, 2, 30),
      cooldownSeconds: boundedInt(otp.cooldownSeconds, env.smsOtpCooldownSeconds, 10, 600),
      hourlyLimit: boundedInt(otp.hourlyLimit, env.smsOtpHourlyLimit, 1, 30),
      ipHourlyLimit: boundedInt(otp.ipHourlyLimit, env.smsOtpIpHourlyLimit, 1, 100),
      maxAttempts: boundedInt(otp.maxAttempts, env.smsOtpMaxAttempts, 1, 10)
    } satisfies OtpRuntimeSettings
  };
}

export async function assertPaymentMethodEnabled(method: "card_to_card" | "pos" | "cash") {
  const { payment } = await getRuntimeSettings();
  const enabled = method === "card_to_card" ? payment.cardToCard : method === "pos" ? payment.pos : payment.cash;
  if (!enabled) throw new Error("PAYMENT_METHOD_DISABLED");
}
