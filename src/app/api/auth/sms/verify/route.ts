import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { loadUserAccess, setSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { acquirePlayerMobileLocks, ensureUserPlayer, releasePlayerMobileLocks } from "@/lib/player-identity";

const schema = z.object({
  mobile: z.string().regex(/^09\d{9}$/),
  code: z.string().regex(/^\d{6}$/)
});

type OtpRow = RowDataPacket & {
  id: number;
  code_hash: string;
  attempts: number;
};

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  status: string;
};

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());

    if (env.dataMode === "mock") {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ message: "ورود پیامکی آزمایشی در محیط انتشار غیرفعال است." }, { status: 503 });
      }
      if (input.code !== env.mockSmsCode) {
        return NextResponse.json({ message: "کد تایید نادرست است." }, { status: 401 });
      }
      const user = {
        id: "sms-demo",
        name: "کاربر پیامکی",
        mobile: input.mobile,
        role: "player" as const,
        roles: ["player"],
        permissions: ["tournaments.view"]
      };
      await setSession(user, request);
      return NextResponse.json({ ok: true, role: "player" });
    }

    const connection = await db.getConnection();
    let locks: string[] = [];
    let userId: number;

    try {
      locks = await acquirePlayerMobileLocks(connection, [input.mobile]);
      await connection.beginTransaction();

      const [otpRows] = await connection.query<OtpRow[]>(`
        SELECT id,code_hash,attempts
        FROM otp_codes
        WHERE destination=?
          AND purpose='login'
          AND consumed_at IS NULL
          AND expires_at>NOW()
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `, [input.mobile]);

      const otp = otpRows[0];
      if (!otp || otp.attempts >= env.smsOtpMaxAttempts) {
        await connection.rollback();
        return NextResponse.json({ message: "کد تایید منقضی یا نامعتبر است." }, { status: 401 });
      }

      const valid = await compare(input.code, otp.code_hash);
      if (!valid) {
        const nextAttempts = otp.attempts + 1;
        await connection.execute(`
          UPDATE otp_codes
          SET attempts=?,consumed_at=IF(? >= ?,NOW(),consumed_at)
          WHERE id=?
        `, [nextAttempts, nextAttempts, env.smsOtpMaxAttempts, otp.id]);
        await connection.commit();
        return NextResponse.json({ message: "کد تایید نادرست است." }, { status: 401 });
      }

      const [consumeResult] = await connection.execute<ResultSetHeader>(`
        UPDATE otp_codes SET consumed_at=NOW()
        WHERE id=? AND consumed_at IS NULL
      `, [otp.id]);

      if (consumeResult.affectedRows !== 1) {
        await connection.rollback();
        return NextResponse.json({ message: "این کد قبلاً استفاده شده است." }, { status: 409 });
      }

      const [users] = await connection.query<UserRow[]>(`
        SELECT id,name,status
        FROM users
        WHERE mobile=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [input.mobile]);

      let userName: string;
      if (users[0]) {
        if (users[0].status !== "ACTIVE") {
          await connection.rollback();
          return NextResponse.json({ message: "حساب کاربری فعال نیست." }, { status: 403 });
        }
        userId = users[0].id;
        userName = users[0].name;
        await connection.execute(`UPDATE users SET mobile_verified=1,updated_at=NOW() WHERE id=?`, [userId]);
      } else {
        userName = `کاربر ${input.mobile.slice(-4)}`;
        const [created] = await connection.execute<ResultSetHeader>(`
          INSERT INTO users(
            public_id,name,mobile,status,mobile_verified,email_verified,
            two_factor_enabled,created_at,updated_at
          ) VALUES(UUID(),?,?,'ACTIVE',1,0,0,NOW(),NOW())
        `, [userName, input.mobile]);
        userId = created.insertId;
        await connection.execute(`
          INSERT INTO user_roles(user_id,role_id,created_at)
          SELECT ?,id,NOW() FROM roles WHERE name='player' LIMIT 1
        `, [userId]);
      }

      await ensureUserPlayer(connection, { id: userId, name: userName, mobile: input.mobile });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, locks);
      connection.release();
    }

    const user = await loadUserAccess(userId);
    if (!user) return NextResponse.json({ message: "حساب کاربری ایجاد نشد." }, { status: 500 });
    await setSession(user, request);
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات تایید نامعتبر است." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "PLAYER_IDENTITY_LOCK_TIMEOUT") {
      return NextResponse.json({ message: "درخواست دیگری برای این شماره در حال پردازش است. دوباره تلاش کنید." }, { status: 409 });
    }
    console.error("auth.sms.verify.failed", error);
    return NextResponse.json({ message: "تایید کد انجام نشد." }, { status: 500 });
  }
}
