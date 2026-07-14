import { NextResponse } from "next/server";
import { queryRows } from "@/lib/db";
import { productionConfigurationWarnings } from "@/lib/env";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const rows = await queryRows<(RowDataPacket & { ok: number })[]>(`SELECT 1 AS ok`);
    return NextResponse.json({
      ok: rows[0]?.ok === 1,
      service: "coffee-game-satarkhan",
      database: "mysql",
      configurationWarnings: productionConfigurationWarnings(),
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error("health.database.failed", error);
    return NextResponse.json({
      ok: false,
      service: "coffee-game-satarkhan",
      database: "unavailable",
      time: new Date().toISOString()
    }, { status: 503 });
  }
}
