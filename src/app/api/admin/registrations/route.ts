import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { recentRegistrations } from "@/data/mock-data";

type RegistrationRow = RowDataPacket & {
  id: number;
  public_id: string;
  tournament_title: string;
  status: string;
  slots: number;
  names: string | null;
  mobiles: string | null;
  checked_in_at: Date | null;
  created_at: Date;
};

export async function GET() {
  const auth = await authorize("checkin.manage");
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({
      items: recentRegistrations.map((item, index) => ({
        id: `mock-${index}`,
        publicId: `mock-${index}`,
        tournamentTitle: item.tournament,
        status: index % 2 === 0 ? "CHECKED_IN" : "CONFIRMED",
        slots: 1,
        names: item.name,
        mobiles: `0912000${String(index).padStart(4, "0")}`,
        checkedInAt: index % 2 === 0 ? new Date().toISOString() : null,
        createdAt: new Date().toISOString()
      }))
    });
  }

  const rows = await queryRows<RegistrationRow[]>(`
    SELECT r.id,r.public_id,t.title AS tournament_title,r.status,r.slots,r.checked_in_at,r.created_at,
      GROUP_CONCAT(DISTINCT COALESCE(p.name,tp.name,tm.title) ORDER BY COALESCE(p.name,tp.name,tm.title) SEPARATOR '، ') AS names,
      GROUP_CONCAT(DISTINCT COALESCE(p.mobile,tp.mobile) ORDER BY COALESCE(p.mobile,tp.mobile) SEPARATOR '، ') AS mobiles
    FROM registrations r
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN registration_entries re ON re.registration_id=r.id
    LEFT JOIN players p ON p.id=re.player_id
    LEFT JOIN teams tm ON tm.id=re.team_id
    LEFT JOIN team_members tmem ON tmem.team_id=tm.id
    LEFT JOIN players tp ON tp.id=tmem.player_id
    WHERE r.deleted_at IS NULL
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 300
  `);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: String(row.id),
      publicId: row.public_id,
      tournamentTitle: row.tournament_title,
      status: row.status,
      slots: Number(row.slots),
      names: row.names || "بدون نام",
      mobiles: row.mobiles || "—",
      checkedInAt: row.checked_in_at ? new Date(row.checked_in_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString()
    }))
  });
}
