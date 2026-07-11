function integerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const env = {
  dataMode: process.env.DATA_MODE === "mysql" ? "mysql" : "mock",
  authSecret: process.env.AUTH_SECRET || "unsafe-development-secret",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  mockSmsCode: process.env.MOCK_SMS_CODE || "123456",
  smsProvider: process.env.SMS_PROVIDER === "smsir" ? "smsir" : "mock",
  smsIrApiKey: process.env.SMSIR_API_KEY || "",
  smsIrTemplateId: integerEnv("SMSIR_TEMPLATE_ID", 0),
  smsOtpTtlMinutes: integerEnv("SMS_OTP_TTL_MINUTES", 5),
  smsOtpMaxAttempts: integerEnv("SMS_OTP_MAX_ATTEMPTS", 5),
  smsOtpCooldownSeconds: integerEnv("SMS_OTP_COOLDOWN_SECONDS", 60),
  sessionDays: integerEnv("SESSION_DAYS", 7)
} as const;
