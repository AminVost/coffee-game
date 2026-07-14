import { env, assertSmsConfiguration } from "@/lib/env";

type SmsParameter = { name: string; value: string };

type SmsDeliveryResult = {
  provider: "smsir" | "database";
  skipped: boolean;
};

async function sendSmsIrTemplate(mobile: string, templateId: number, parameters: SmsParameter[]) {
  if (!templateId) return { provider: "smsir" as const, skipped: true as const };
  if (!env.smsIrApiKey) throw new Error("SMSIR_CONFIGURATION_MISSING");

  const response = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": env.smsIrApiKey
    },
    body: JSON.stringify({ mobile, templateId, parameters }),
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as { status?: number; message?: string } | null;
  if (!response.ok || payload?.status !== 1) {
    throw new Error(payload?.message || "SMSIR_SEND_FAILED");
  }

  return { provider: "smsir" as const, skipped: false as const };
}

export async function sendOtpSms(mobile: string, code: string): Promise<SmsDeliveryResult> {
  assertSmsConfiguration();

  if (env.smsProvider === "database") {
    // The code is intentionally not returned to the browser. In this development
    // provider it can only be read from the database by an authorized developer.
    return { provider: "database", skipped: true };
  }

  await sendSmsIrTemplate(mobile, env.smsIrTemplateId, [{ name: "Code", value: code }]);
  return { provider: "smsir", skipped: false };
}

export async function sendPaymentStatusSms({
  mobile,
  tournamentTitle,
  status,
  reason
}: {
  mobile: string;
  tournamentTitle: string;
  status: "APPROVED" | "REJECTED";
  reason?: string | null;
}) {
  if (env.smsProvider === "database") {
    return { provider: "database" as const, skipped: true as const };
  }

  const templateId = status === "APPROVED"
    ? env.smsIrPaymentApprovedTemplateId
    : env.smsIrPaymentRejectedTemplateId;

  const parameters: SmsParameter[] = [
    { name: "Tournament", value: tournamentTitle.slice(0, 80) }
  ];
  if (status === "REJECTED") {
    parameters.push({ name: "Reason", value: (reason || "نیاز به اصلاح اطلاعات پرداخت").slice(0, 120) });
  }

  return sendSmsIrTemplate(mobile, templateId, parameters);
}

export async function sendRegistrationTrackingSms({
  mobile,
  tournamentTitle,
  trackingCode,
  trackingUrl
}: {
  mobile: string;
  tournamentTitle: string;
  trackingCode: string;
  trackingUrl: string;
}) {
  if (env.smsProvider === "database") {
    return { provider: "database" as const, skipped: true as const };
  }

  return sendSmsIrTemplate(mobile, env.smsIrRegistrationTrackingTemplateId, [
    { name: "Tournament", value: tournamentTitle.slice(0, 80) },
    { name: "TrackingCode", value: trackingCode.slice(0, 32) },
    { name: "TrackingUrl", value: trackingUrl.slice(0, 180) }
  ]);
}
