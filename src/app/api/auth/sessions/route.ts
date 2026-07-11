import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { currentSessionHash } from "@/lib/auth";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";

type SessionRow = RowDataPacket & {
  id: number;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
};

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({
      items: [{
        id: "mock-current",
        ipAddress: "127.0.0.1",
        userAgent: "مرورگر فعلی",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        isCurrent: true
      }]
    });
  }

  const currentHash = currentSessionHash(auth.user);
  const rows = await queryRows<SessionRow[]>(`
    SELECT id, token_hash, ip_address, user_agent, expires_at, created_at
    FROM sessions
    WHERE user_id=? AND revoked_at IS NULL AND expires_at>NOW()
    ORDER BY created_at DESC
  `, [auth.user.id]);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      isCurrent: row.token_hash === currentHash
    }))
  });
}
