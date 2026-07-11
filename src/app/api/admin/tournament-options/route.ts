import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";

export async function GET() {
  const auth = await authorize("tournaments.view");
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({
      games: [{ id: 1, title: "FC 26 روی PS5" }, { id: 2, title: "تخته‌نرد" }],
      venues: [{ id: 1, title: "Coffee Game ستارخان" }, { id: 2, title: "سالن رویداد آریا" }]
    });
  }

  const games = await queryRows<RowDataPacket[]>(`SELECT id,title FROM games WHERE is_active=1 ORDER BY id`);
  const venues = await queryRows<RowDataPacket[]>(`SELECT id,title FROM venues WHERE is_active=1 ORDER BY id`);
  return NextResponse.json({ games, venues });
}
