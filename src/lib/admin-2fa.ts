import { createHash, randomBytes, randomInt } from "crypto";
import { hash } from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/runtime-settings";
import { sendOtpSms } from "@/lib/sms";
import { getRequestIp, getRequestUserAgent } from "@/lib/request-context";
import { env } from "@/lib/env";

export function hashChallengeToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function maskMobile(mobile: string) { return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`; }

export async function createAdminLoginChallenge(userId: number, mobile: string, request: Request) {
  const settings = await getRuntimeSettings();
  const token = randomBytes(32).toString("hex");
  const code = String(randomInt(100000, 1000000));
  const codeHash = await hash(code, 10);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`UPDATE admin_login_challenges SET consumed_at=COALESCE(consumed_at,NOW()) WHERE user_id=? AND consumed_at IS NULL`, [userId]);
    await connection.execute(`UPDATE otp_codes SET consumed_at=COALESCE(consumed_at,NOW()) WHERE user_id=? AND purpose='admin_2fa' AND consumed_at IS NULL`, [userId]);
    const [otp] = await connection.execute<ResultSetHeader>(`
      INSERT INTO otp_codes(user_id,destination,purpose,code_hash,attempts,request_ip,expires_at,created_at)
      VALUES(?,?,'admin_2fa',?,0,?,DATE_ADD(NOW(),INTERVAL ? MINUTE),NOW())
    `, [userId, mobile, codeHash, getRequestIp(request), settings.otp.ttlMinutes]);
    await connection.execute(`
      INSERT INTO admin_login_challenges(user_id,token_hash,otp_id,ip_address,user_agent,expires_at,created_at)
      VALUES(?,?,?,?,?,DATE_ADD(NOW(),INTERVAL ? MINUTE),NOW())
    `, [userId, hashChallengeToken(token), otp.insertId, getRequestIp(request), getRequestUserAgent(request), settings.otp.ttlMinutes]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }

  try { await sendOtpSms(mobile, code); }
  catch (error) {
    await db.execute(`UPDATE admin_login_challenges SET consumed_at=NOW() WHERE token_hash=?`, [hashChallengeToken(token)]);
    throw error;
  }
  return { token, developmentCode: env.smsProvider === "database" ? code : undefined };
}
