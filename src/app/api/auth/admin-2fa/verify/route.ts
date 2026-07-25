import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { hashChallengeToken } from "@/lib/admin-2fa";
import { loadUserAccess, setSession } from "@/lib/auth";
import { getRuntimeSettings } from "@/lib/runtime-settings";

const schema = z.object({ challengeToken: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().regex(/^\d{6}$/) });
type ChallengeRow = RowDataPacket & { id: number; user_id: number; otp_id: number; code_hash: string; attempts: number; destination: string };

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const settings = await getRuntimeSettings();
    const connection = await db.getConnection();
    let userId = 0;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<ChallengeRow[]>(`
        SELECT c.id,c.user_id,c.otp_id,o.code_hash,o.attempts,o.destination
        FROM admin_login_challenges c JOIN otp_codes o ON o.id=c.otp_id
        JOIN users u ON u.id=c.user_id
        WHERE c.token_hash=? AND c.consumed_at IS NULL AND c.expires_at>NOW()
          AND o.consumed_at IS NULL AND o.expires_at>NOW() AND o.purpose='admin_2fa'
          AND u.status='ACTIVE' AND u.deleted_at IS NULL
        LIMIT 1 FOR UPDATE
      `, [hashChallengeToken(input.challengeToken)]);
      const row = rows[0];
      if (!row || row.attempts >= settings.otp.maxAttempts) {
        await connection.rollback();
        return NextResponse.json({ message: "چالش ورود منقضی یا نامعتبر است." }, { status: 401 });
      }
      if (!(await compare(input.code, row.code_hash))) {
        const attempts = row.attempts + 1;
        await connection.execute(`UPDATE otp_codes SET attempts=?,consumed_at=IF(? >= ?,NOW(),consumed_at) WHERE id=?`, [attempts, attempts, settings.otp.maxAttempts, row.otp_id]);
        if (attempts >= settings.otp.maxAttempts) await connection.execute(`UPDATE admin_login_challenges SET consumed_at=NOW() WHERE id=?`, [row.id]);
        await connection.commit();
        return NextResponse.json({ message: "کد تأیید نادرست است." }, { status: 401 });
      }
      await connection.execute(`UPDATE otp_codes SET consumed_at=NOW() WHERE id=?`, [row.otp_id]);
      await connection.execute(`UPDATE admin_login_challenges SET consumed_at=NOW() WHERE id=?`, [row.id]);
      userId = row.user_id;
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    const user = await loadUserAccess(userId);
    if (!user || user.role !== "admin") return NextResponse.json({ message: "حساب مدیر معتبر نیست." }, { status: 403 });
    await setSession(user, request);
    return NextResponse.json({ ok: true, role: "admin" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "اطلاعات تأیید نامعتبر است." }, { status: 422 });
    console.error("admin-2fa.verify.failed", error);
    return NextResponse.json({ message: "تأیید ورود انجام نشد." }, { status: 500 });
  }
}
