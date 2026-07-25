import { createHash } from "crypto";
import type { RowDataPacket } from "mysql2";
import { execute, queryRows } from "@/lib/db";
import { getRequestIp } from "@/lib/request-context";

type CountRow = RowDataPacket & { attempts: number; window_started_at: Date };

function keyHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowSeconds: number, subject?: string) {
  const identity = subject || getRequestIp(request) || "unknown";
  const bucket = keyHash(`${scope}:${identity}`);
  await execute(`
    INSERT INTO rate_limits(scope_key,attempts,window_started_at,updated_at)
    VALUES(?,1,NOW(),NOW())
    ON DUPLICATE KEY UPDATE
      attempts=IF(window_started_at < DATE_SUB(NOW(), INTERVAL ? SECOND),1,attempts+1),
      window_started_at=IF(window_started_at < DATE_SUB(NOW(), INTERVAL ? SECOND),NOW(),window_started_at),
      updated_at=NOW()
  `, [bucket, windowSeconds, windowSeconds]);

  const rows = await queryRows<CountRow[]>(`SELECT attempts,window_started_at FROM rate_limits WHERE scope_key=? LIMIT 1`, [bucket]);
  const attempts = Number(rows[0]?.attempts || 0);
  if (attempts > limit) {
    const error = new Error("RATE_LIMIT_EXCEEDED") as Error & { status?: number; retryAfter?: number };
    error.status = 429;
    error.retryAfter = windowSeconds;
    throw error;
  }
}
