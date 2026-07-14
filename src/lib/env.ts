function integerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanEnv(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const smsProviderValue = (process.env.SMS_PROVIDER || "database").toLowerCase();
const smsProvider = smsProviderValue === "smsir" ? "smsir" : "database";

export const env = {
  databaseUrl: process.env.DATABASE_URL || "",
  authSecret: process.env.AUTH_SECRET?.trim() || "local-development-secret-change-before-production",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  smsProvider,
  allowDatabaseOtp: booleanEnv("ALLOW_DATABASE_OTP", process.env.NODE_ENV !== "production"),
  smsIrApiKey: process.env.SMSIR_API_KEY || "",
  smsIrTemplateId: integerEnv("SMSIR_TEMPLATE_ID", 0),
  smsIrPaymentApprovedTemplateId: integerEnv("SMSIR_PAYMENT_APPROVED_TEMPLATE_ID", 0),
  smsIrPaymentRejectedTemplateId: integerEnv("SMSIR_PAYMENT_REJECTED_TEMPLATE_ID", 0),
  smsIrRegistrationTrackingTemplateId: integerEnv("SMSIR_REGISTRATION_TRACKING_TEMPLATE_ID", 0),
  registrationHoldMinutes: integerEnv("REGISTRATION_HOLD_MINUTES", 15),
  paymentCorrectionHours: integerEnv("PAYMENT_CORRECTION_HOURS", 2),
  smsOtpTtlMinutes: integerEnv("SMS_OTP_TTL_MINUTES", 5),
  smsOtpMaxAttempts: integerEnv("SMS_OTP_MAX_ATTEMPTS", 5),
  smsOtpCooldownSeconds: integerEnv("SMS_OTP_COOLDOWN_SECONDS", 60),
  smsOtpHourlyLimit: integerEnv("SMS_OTP_HOURLY_LIMIT", 5),
  smsOtpIpHourlyLimit: integerEnv("SMS_OTP_IP_HOURLY_LIMIT", 20),
  sessionDays: integerEnv("SESSION_DAYS", 7)
} as const;

export function assertDatabaseConfiguration() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL_REQUIRED");
  }
}

export function assertSmsConfiguration() {
  if (env.smsProvider === "database") {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_OTP_NOT_ALLOWED_IN_PRODUCTION");
    if (!env.allowDatabaseOtp) throw new Error("DATABASE_OTP_DISABLED");
    return;
  }

  if (!env.smsIrApiKey || !env.smsIrTemplateId) {
    throw new Error("SMSIR_CONFIGURATION_MISSING");
  }
}

export function assertAuthConfiguration() {
  if (process.env.NODE_ENV === "production" && (!process.env.AUTH_SECRET || env.authSecret.length < 32)) {
    throw new Error("AUTH_SECRET_PRODUCTION_REQUIRED");
  }
}

export function productionConfigurationWarnings() {
  const warnings: string[] = [];
  if (!env.databaseUrl) warnings.push("DATABASE_URL تنظیم نشده است.");
  if (!process.env.AUTH_SECRET || env.authSecret.length < 32) {
    warnings.push("AUTH_SECRET باید یک مقدار تصادفی حداقل ۳۲ کاراکتری باشد.");
  }
  if (env.smsProvider !== "smsir") warnings.push("SMS_PROVIDER هنوز روی database است.");
  if (env.appUrl.includes("localhost")) warnings.push("NEXT_PUBLIC_APP_URL هنوز localhost است.");
  return warnings;
}
