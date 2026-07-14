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
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(120).optional()
});

type OtpRow = RowDataPacket & {
  id: number;
  user_id: number | null;
  code_hash: string;
  attempts: number;
};

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  status: string;
  two_step_code_hash: string | null;
  two_step_attempts: number;
  two_step_expires_at: Date | null;
};

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const connection = await db.getConnection();
    let locks: string[] = [];
    let userId = 0;

    try {
      locks = await acquirePlayerMobileLocks(connection, [input.mobile]);
      await connection.beginTransaction();

      const [users] = await connection.query<UserRow[]>(`
        SELECT id,name,status,two_step_code_hash,two_step_attempts,two_step_expires_at
        FROM users
        WHERE mobile=? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [input.mobile]);
      const account = users[0];

      const [otpRows] = await connection.query<OtpRow[]>(`
        SELECT id,user_id,code_hash,attempts
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

      if (
        !account
        || !otp
        || (otp.user_id !== null && otp.user_id !== account.id)
        || !account.two_step_code_hash
        || !account.two_step_expires_at
        || new Date(account.two_step_expires_at).getTime() <= Date.now()
        || otp.attempts >= env.smsOtpMaxAttempts
        || account.two_step_attempts >= env.smsOtpMaxAttempts
      ) {
        await connection.rollback();
        return NextResponse.json({ message: "کد تأیید منقضی یا نامعتبر است." }, { status: 401 });
      }

      if (["SUSPENDED", "DELETED"].includes(account.status)) {
        await connection.rollback();
        return NextResponse.json({ message: "حساب کاربری فعال نیست." }, { status: 403 });
      }

      const [validOtp, validUserMirror] = await Promise.all([
        compare(input.code, otp.code_hash),
        compare(input.code, account.two_step_code_hash)
      ]);

      if (!validOtp || !validUserMirror) {
        const nextAttempts = Math.max(otp.attempts, account.two_step_attempts) + 1;
        await connection.execute(`
          UPDATE otp_codes
          SET attempts=?,consumed_at=IF(? >= ?,NOW(),consumed_at)
          WHERE id=?
        `, [nextAttempts, nextAttempts, env.smsOtpMaxAttempts, otp.id]);
        await connection.execute(`
          UPDATE users
          SET two_step_attempts=?,
              two_step_code_hash=IF(? >= ?,NULL,two_step_code_hash),
              two_step_development_code=IF(? >= ?,NULL,two_step_development_code),
              two_step_expires_at=IF(? >= ?,NULL,two_step_expires_at),
              updated_at=NOW()
          WHERE id=?
        `, [
          nextAttempts,
          nextAttempts, env.smsOtpMaxAttempts,
          nextAttempts, env.smsOtpMaxAttempts,
          nextAttempts, env.smsOtpMaxAttempts,
          account.id
        ]);
        await connection.commit();
        return NextResponse.json({ message: "کد تأیید نادرست است." }, { status: 401 });
      }

      const [consumeResult] = await connection.execute<ResultSetHeader>(`
        UPDATE otp_codes SET consumed_at=NOW()
        WHERE id=? AND consumed_at IS NULL
      `, [otp.id]);
      if (consumeResult.affectedRows !== 1) {
        await connection.rollback();
        return NextResponse.json({ message: "این کد قبلاً استفاده شده است." }, { status: 409 });
      }

      userId = account.id;
      let userName = account.name;
      if (input.name?.trim() && (userName.startsWith("کاربر ") || userName === "کاربر پیامکی")) {
        userName = input.name.trim();
      }

      await connection.execute(`
        UPDATE users
        SET
          name=?,status='ACTIVE',mobile_verified=1,
          two_step_code_hash=NULL,two_step_development_code=NULL,
          two_step_expires_at=NULL,two_step_attempts=0,
          updated_at=NOW()
        WHERE id=?
      `, [userName, userId]);

      await connection.execute(`
        INSERT IGNORE INTO user_roles(user_id,role_id,created_at)
        SELECT ?,id,NOW() FROM roles WHERE name='player' LIMIT 1
      `, [userId]);

      await ensureUserPlayer(connection, { id: userId, name: userName, mobile: input.mobile });

      await connection.execute(`
        UPDATE registrations r
        JOIN tournaments t ON t.id=r.tournament_id
        SET
          r.buyer_user_id=?,
          r.contact_mobile=COALESCE(r.contact_mobile,?),
          r.updated_at=NOW()
        WHERE r.buyer_user_id IS NULL
          AND (
            r.contact_mobile=?
            OR (
              r.contact_mobile IS NULL
              AND t.participant_type='INDIVIDUAL'
              AND (
                SELECT p.mobile
                FROM registration_entries re
                JOIN players p ON p.id=re.player_id
                WHERE re.registration_id=r.id
                ORDER BY re.id ASC
                LIMIT 1
              )=?
            )
            OR (
              r.contact_mobile IS NULL
              AND t.participant_type='TEAM'
              AND (
                SELECT p.mobile
                FROM registration_entries re
                JOIN team_members tm ON tm.team_id=re.team_id
                JOIN players p ON p.id=tm.player_id
                WHERE re.registration_id=r.id
                ORDER BY tm.is_captain DESC,tm.joined_at ASC
                LIMIT 1
              )=?
            )
          )
      `, [userId, input.mobile, input.mobile, input.mobile, input.mobile]);

      await connection.execute(`
        UPDATE payments p
        JOIN registrations r ON r.id=p.registration_id
        SET p.user_id=?,p.updated_at=NOW()
        WHERE p.user_id IS NULL AND r.buyer_user_id=?
      `, [userId, userId]);

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
      return NextResponse.json({ message: "اطلاعات تأیید نامعتبر است." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "PLAYER_IDENTITY_LOCK_TIMEOUT") {
      return NextResponse.json({ message: "درخواست دیگری برای این شماره در حال پردازش است. دوباره تلاش کنید." }, { status: 409 });
    }
    console.error("auth.sms.verify.failed", error);
    return NextResponse.json({ message: "تأیید کد انجام نشد." }, { status: 500 });
  }
}
