import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";

export async function GET() {
  const auth = await authorize("tournaments.view");
  if (auth.response) return auth.response;

  const games = await queryRows<RowDataPacket[]>(`SELECT id,title FROM games WHERE is_active=1 ORDER BY id`);
  const venues = await queryRows<RowDataPacket[]>(`SELECT id,title FROM venues WHERE is_active=1 ORDER BY id`);
  return NextResponse.json({ games, venues });
}
