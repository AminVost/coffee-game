import { env } from "@/lib/env";

export async function sendOtpSms(mobile: string, code: string) {
  if (env.smsProvider === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
    }
    return { provider: "mock" as const, debugCode: code };
  }

  if (!env.smsIrApiKey || !env.smsIrTemplateId) {
    throw new Error("SMSIR_CONFIGURATION_MISSING");
  }

  const response = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": env.smsIrApiKey
    },
    body: JSON.stringify({
      mobile,
      templateId: env.smsIrTemplateId,
      parameters: [{ name: "Code", value: code }]
    }),
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as { status?: number; message?: string } | null;

  if (!response.ok || payload?.status !== 1) {
    throw new Error(payload?.message || "SMSIR_SEND_FAILED");
  }

  return { provider: "smsir" as const };
}
