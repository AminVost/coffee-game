import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";
import { adminStats, recentRegistrations } from "@/data/mock-data";

type StatsRow = RowDataPacket & {
  active_tournaments: number;
  monthly_registrations: number;
  pending_payments: number;
  approved_revenue: number;
  active_users: number;
};

type RecentRow = RowDataPacket & {
  name: string;
  tournament: string;
  status: string;
  amount: number;
};

export async function GET() {
  const auth = await authorize("tournaments.view");
  if (auth.response) return auth.response;

  if (env.dataMode === "mock") {
    return NextResponse.json({ stats: adminStats, recentRegistrations });
  }

  const statsRows = await queryRows<StatsRow[]>(`
    SELECT
      (SELECT COUNT(*) FROM tournaments WHERE deleted_at IS NULL AND status IN ('PUBLISHED','REGISTRATION_OPEN','RUNNING')) AS active_tournaments,
      (SELECT COUNT(*) FROM registrations WHERE deleted_at IS NULL AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')) AS monthly_registrations,
      (SELECT COUNT(*) FROM payments WHERE status='PENDING') AS pending_payments,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='APPROVED') AS approved_revenue,
      (SELECT COUNT(*) FROM users WHERE status='ACTIVE' AND deleted_at IS NULL) AS active_users
  `);
  const recent = await queryRows<RecentRow[]>(`
    SELECT COALESCE(u.name,p.name,tm.title,'مهمان') AS name,t.title AS tournament,r.status,pay.amount
    FROM registrations r
    JOIN tournaments t ON t.id=r.tournament_id
    LEFT JOIN users u ON u.id=r.buyer_user_id
    LEFT JOIN registration_entries re ON re.registration_id=r.id
    LEFT JOIN players p ON p.id=re.player_id
    LEFT JOIN teams tm ON tm.id=re.team_id
    LEFT JOIN payments pay ON pay.registration_id=r.id
    WHERE r.deleted_at IS NULL
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 8
  `);
  const stats = statsRows[0];
  return NextResponse.json({
    stats: [
      { title: "مسابقات فعال", value: String(stats.active_tournaments), hint: "منتشرشده و در حال اجرا", trend: "" },
      { title: "ثبت‌نام‌های ماه", value: String(stats.monthly_registrations), hint: `${stats.pending_payments} پرداخت در انتظار`, trend: "" },
      { title: "درآمد تاییدشده", value: Number(stats.approved_revenue).toLocaleString("fa-IR"), hint: "تومان", trend: "" },
      { title: "کاربران فعال", value: String(stats.active_users), hint: "حساب فعال", trend: "" }
    ],
    recentRegistrations: recent.map((row) => ({
      name: row.name,
      tournament: row.tournament,
      status: row.status,
      amount: Number(row.amount || 0).toLocaleString("fa-IR")
    }))
  });
}
