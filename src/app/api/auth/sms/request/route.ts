import { randomInt } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db, execute } from "@/lib/db";
import { env } from "@/lib/env";
import { getRequestIp } from "@/lib/request-context";
import { sendOtpSms } from "@/lib/sms";

const schema = z.object({
  mobile: z.string().regex(/^09\d{9}$/),
  name: z.string().trim().min(2).max(120).optional()
});

type OtpRateRow = RowDataPacket & {
  seconds_since_last: number | null;
  hourly_count: number;
};

type IpRateRow = RowDataPacket & { hourly_count: number };
type UserRow = RowDataPacket & { id: number; name: string; status: string };

export async function POST(request: Request) {
  try {
    const { mobile, name } = schema.parse(await request.json());
    const requestIp = getRequestIp(request);

    const connection = await db.getConnection();
    let otpId = 0;
    let userId = 0;
    const code = String(randomInt(100000, 1000000));
    const codeHash = await hash(code, 10);
    const developmentCode = env.smsProvider === "database" ? code : null;

    try {
      await connection.beginTransaction();

      const [rateRows] = await connection.query<OtpRateRow[]>(`
        SELECT
          TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) AS seconds_since_last,
          SUM(created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) AS hourly_count
        FROM otp_codes
        WHERE destination=? AND purpose='login'
        FOR UPDATE
      `, [mobile]);

      const rate = rateRows[0];
      if (rate?.seconds_since_last !== null && Number(rate.seconds_since_last) < env.smsOtpCooldownSeconds) {
        await connection.rollback();
        return NextResponse.json({
          message: `برای درخواست کد جدید ${env.smsOtpCooldownSeconds - Number(rate.seconds_since_last)} ثانیه صبر کنید.`
        }, { status: 429 });
      }

      if (Number(rate?.hourly_count || 0) >= env.smsOtpHourlyLimit) {
        await connection.rollback();
        return NextResponse.json({
          message: "تعداد درخواست‌های پیامکی این شماره بیش از حد مجاز است. یک ساعت بعد دوباره تلاش کنید."
        }, { status: 429 });
      }

      if (requestIp) {
        const [ipRows] = await connection.query<IpRateRow[]>(`
          SELECT COUNT(*) AS hourly_count
          FROM otp_codes
          WHERE request_ip=? AND created_at>=DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `, [requestIp]);
        if (Number(ipRows[0]?.hourly_count || 0) >= env.smsOtpIpHourlyLimit) {
          await connection.rollback();
          return NextResponse.json({
            message: "تعداد درخواست‌های کد از این اتصال بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
          }, { status: 429 });
        }
      }

      const [users] = await connection.query<UserRow[]>(`
        SELECT id,name,status
        FROM users
        WHERE mobile=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [mobile]);

      const existing = users[0];
      if (existing && ["SUSPENDED", "DELETED"].includes(existing.status)) {
        await connection.rollback();
        return NextResponse.json({ message: "این حساب امکان ورود ندارد." }, { status: 403 });
      }

      if (existing) {
        userId = existing.id;
        const nextName = name?.trim()
          && (existing.name.startsWith("کاربر ") || existing.name === "کاربر پیامکی")
          ? name.trim()
          : existing.name;
        await connection.execute(`
          UPDATE users
          SET
            name=?,
            two_step_code_hash=?,
            two_step_development_code=?,
            two_step_expires_at=DATE_ADD(NOW(), INTERVAL ? MINUTE),
            two_step_attempts=0,
            two_step_requested_at=NOW(),
            updated_at=NOW()
          WHERE id=?
        `, [nextName, codeHash, developmentCode, env.smsOtpTtlMinutes, userId]);
      } else {
        const userName = name?.trim() || `کاربر ${mobile.slice(-4)}`;
        const [created] = await connection.execute<ResultSetHeader>(`
          INSERT INTO users(
            public_id,name,mobile,status,mobile_verified,email_verified,
            two_factor_enabled,two_step_code_hash,two_step_development_code,
            two_step_expires_at,two_step_attempts,two_step_requested_at,
            created_at,updated_at
          ) VALUES(
            UUID(),?,?,'PENDING',0,0,0,?,?,
            DATE_ADD(NOW(), INTERVAL ? MINUTE),0,NOW(),NOW(),NOW()
          )
        `, [userName, mobile, codeHash, developmentCode, env.smsOtpTtlMinutes]);
        userId = created.insertId;
        await connection.execute(`
          INSERT IGNORE INTO user_roles(user_id,role_id,created_at)
          SELECT ?,id,NOW() FROM roles WHERE name='player' LIMIT 1
        `, [userId]);
      }

      await connection.execute(`
        UPDATE otp_codes
        SET consumed_at=COALESCE(consumed_at,NOW())
        WHERE destination=? AND purpose='login' AND consumed_at IS NULL
      `, [mobile]);

      const [otpResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO otp_codes(
          user_id,destination,purpose,code_hash,attempts,
          request_ip,expires_at,created_at
        ) VALUES(?,?,'login',?,0,?,DATE_ADD(NOW(), INTERVAL ? MINUTE),NOW())
      `, [userId, mobile, codeHash, requestIp, env.smsOtpTtlMinutes]);
      otpId = otpResult.insertId;

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    try {
      await sendOtpSms(mobile, code);
      return NextResponse.json({
        ok: true,
        mobile,
        message: env.smsProvider === "database"
          ? "کد تأیید ایجاد شد. تا زمان اتصال سرویس پیامک، کد فقط در دیتابیس محیط توسعه قابل بررسی است."
          : "کد تأیید ارسال شد."
      });
    } catch (error) {
      await execute(`UPDATE otp_codes SET consumed_at=NOW() WHERE id=?`, [otpId]);
      await execute(`
        UPDATE users
        SET two_step_code_hash=NULL,two_step_development_code=NULL,
            two_step_expires_at=NULL,two_step_attempts=0,updated_at=NOW()
        WHERE id=?
      `, [userId]);
      const codeName = error instanceof Error ? error.message : "SMS_SEND_FAILED";
      const configurationError = [
        "SMS_PROVIDER_NOT_CONFIGURED",
        "SMSIR_CONFIGURATION_MISSING",
        "DATABASE_OTP_DISABLED",
        "DATABASE_OTP_NOT_ALLOWED_IN_PRODUCTION"
      ].includes(codeName);
      return NextResponse.json({
        message: configurationError
          ? "سرویس ارسال کد تأیید برای محیط فعلی پیکربندی نشده است."
          : "ارسال کد تأیید انجام نشد. کمی بعد دوباره تلاش کنید."
      }, { status: configurationError ? 503 : 502 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "شماره موبایل یا نام نامعتبر است." }, { status: 422 });
    }
    console.error("auth.sms.request.failed", error);
    return NextResponse.json({ message: "درخواست کد تأیید انجام نشد." }, { status: 500 });
  }
}
