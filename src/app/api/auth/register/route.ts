import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { acquirePlayerMobileLocks, ensureUserPlayer, releasePlayerMobileLocks } from "@/lib/player-identity";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().regex(/^09\d{9}$/),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(100)
});

type ExistingUserRow = RowDataPacket & { id: number };

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const passwordHash = await hash(input.password, 12);
    const connection = await db.getConnection();
    let locks: string[] = [];

    try {
      locks = await acquirePlayerMobileLocks(connection, [input.mobile]);
      await connection.beginTransaction();

      const [existingUsers] = await connection.query<ExistingUserRow[]>(`
        SELECT id
        FROM users
        WHERE deleted_at IS NULL
          AND (mobile=? OR (? <> '' AND email=?))
        LIMIT 1
        FOR UPDATE
      `, [input.mobile, input.email || "", input.email || ""]);

      if (existingUsers.length) {
        await connection.rollback();
        return NextResponse.json({ message: "این موبایل یا ایمیل قبلاً ثبت شده است." }, { status: 409 });
      }

      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO users(
          public_id,name,mobile,email,password_hash,status,mobile_verified,
          email_verified,two_factor_enabled,created_at,updated_at
        ) VALUES(UUID(),?,?,?,?, 'ACTIVE',0,0,0,NOW(),NOW())
      `, [input.name, input.mobile, input.email || null, passwordHash]);

      const userId = result.insertId;
      await ensureUserPlayer(connection, { id: userId, name: input.name, mobile: input.mobile });
      await connection.execute(`
        INSERT INTO user_roles(user_id,role_id,created_at)
        SELECT ?,id,NOW() FROM roles WHERE name='player' LIMIT 1
      `, [userId]);

      await connection.commit();
      return NextResponse.json({ ok: true, userId }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await releasePlayerMobileLocks(connection, locks);
      connection.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات ثبت‌نام معتبر نیست.", errors: error.issues }, { status: 422 });
    }
    if (error instanceof Error && error.message === "PLAYER_IDENTITY_LOCK_TIMEOUT") {
      return NextResponse.json({ message: "درخواست دیگری برای این شماره در حال پردازش است. دوباره تلاش کنید." }, { status: 409 });
    }
    console.error("auth.register.failed", error);
    return NextResponse.json({ message: "خطای داخلی در ثبت‌نام." }, { status: 500 });
  }
}
