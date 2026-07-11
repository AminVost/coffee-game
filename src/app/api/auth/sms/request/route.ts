import { randomInt } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { execute, queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { sendOtpSms } from "@/lib/sms";

const schema = z.object({ mobile: z.string().regex(/^09\d{9}$/) });

type OtpRateRow = RowDataPacket & {
  seconds_since_last: number | null;
  hourly_count: number;
};

export async function POST(request: Request) {
  try {
    const { mobile } = schema.parse(await request.json());

    if (env.dataMode === "mock") {
      return NextResponse.json({
        ok: true,
        mobile,
        message: `کد آزمایشی ${env.mockSmsCode} است.`,
        debugCode: process.env.NODE_ENV === "production" ? undefined : env.mockSmsCode
      });
    }

    const rateRows = await queryRows<OtpRateRow[]>(`
      SELECT
        TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) AS seconds_since_last,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) AS hourly_count
      FROM otp_codes
      WHERE destination=? AND purpose='login'
    `, [mobile]);

    const rate = rateRows[0];
    if (rate?.seconds_since_last !== null && Number(rate.seconds_since_last) < env.smsOtpCooldownSeconds) {
      return NextResponse.json({
        message: `برای درخواست کد جدید ${env.smsOtpCooldownSeconds - Number(rate.seconds_since_last)} ثانیه صبر کنید.`
      }, { status: 429 });
    }

    if (Number(rate?.hourly_count || 0) >= 5) {
      return NextResponse.json({ message: "تعداد درخواست‌های پیامکی بیش از حد مجاز است. یک ساعت بعد دوباره تلاش کنید." }, { status: 429 });
    }

    const code = String(randomInt(100000, 1000000));
    const codeHash = await hash(code, 10);
    const result = await execute(`
      INSERT INTO otp_codes(destination,purpose,code_hash,attempts,expires_at,created_at)
      VALUES(?, 'login', ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())
    `, [mobile, codeHash, env.smsOtpTtlMinutes]);

    try {
      const sent = await sendOtpSms(mobile, code);
      return NextResponse.json({
        ok: true,
        mobile,
        message: "کد تایید ارسال شد.",
        debugCode: sent.provider === "mock" ? sent.debugCode : undefined
      });
    } catch (error) {
      await execute(`UPDATE otp_codes SET consumed_at=NOW() WHERE id=?`, [result.insertId]);
      const codeName = error instanceof Error ? error.message : "SMS_SEND_FAILED";
      const configurationError = codeName === "SMS_PROVIDER_NOT_CONFIGURED" || codeName === "SMSIR_CONFIGURATION_MISSING";
      return NextResponse.json({
        message: configurationError
          ? "سرویس پیامک برای محیط فعلی پیکربندی نشده است."
          : "ارسال پیامک انجام نشد. کمی بعد دوباره تلاش کنید."
      }, { status: configurationError ? 503 : 502 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "شماره موبایل نامعتبر است." }, { status: 422 });
    }
    return NextResponse.json({ message: "درخواست کد تایید انجام نشد." }, { status: 500 });
  }
}
