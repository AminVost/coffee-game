import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { clearSession, currentSessionHash } from "@/lib/auth";
import { execute, queryRows } from "@/lib/db";
import { env } from "@/lib/env";

type SessionRow = RowDataPacket & { token_hash: string };

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "شناسه نشست نامعتبر است." }, { status: 422 });
  }

  if (env.dataMode === "mock") {
    return NextResponse.json({ ok: true });
  }

  const rows = await queryRows<SessionRow[]>(`
    SELECT token_hash FROM sessions WHERE id=? AND user_id=? AND revoked_at IS NULL LIMIT 1
  `, [id, auth.user.id]);

  const session = rows[0];
  if (!session) return NextResponse.json({ message: "نشست یافت نشد." }, { status: 404 });

  await execute(`UPDATE sessions SET revoked_at=NOW() WHERE id=? AND user_id=?`, [id, auth.user.id]);

  if (session.token_hash === currentSessionHash(auth.user)) {
    await clearSession();
  }

  return NextResponse.json({ ok: true });
}
