import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";
import {
  paymentMethodTitle,
  paymentStatusTitle,
  registrationStatusTitle,
  expireStaleRegistrationStateNow
} from "@/lib/registration-flow";
import type { AdminStat } from "@/types";

type StatsRow = RowDataPacket & {
  active_tournaments: number;
  monthly_registrations: number;
  pending_payments: number;
  approved_revenue: number;
  active_users: number;
};

type RecentRegistrationRow = RowDataPacket & {
  id: number;
  name: string;
  tournament: string;
  status: string;
  amount: number;
  created_at: Date;
};

type RecentPaymentRow = RowDataPacket & {
  id: number;
  payer_name: string;
  tournament: string;
  method: string;
  status: string;
  amount: number;
  submitted_at: Date | null;
  created_at: Date;
};

export type AdminDashboardData = {
  stats: AdminStat[];
  pendingPaymentCount: number;
  recentRegistrations: Array<{
    id: string;
    name: string;
    tournament: string;
    status: string;
    amount: string;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    payerName: string;
    tournament: string;
    method: string;
    status: string;
    amount: string;
    createdAt: string;
  }>;
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await expireStaleRegistrationStateNow();

  const [statsRows, recentRegistrationRows, recentPaymentRows] = await Promise.all([
    queryRows<StatsRow[]>(`
      SELECT
        (
          SELECT COUNT(*)
          FROM tournaments
          WHERE deleted_at IS NULL
            AND status IN ('PUBLISHED','REGISTRATION_OPEN','RUNNING')
        ) AS active_tournaments,
        (
          SELECT COUNT(*)
          FROM registrations
          WHERE deleted_at IS NULL
            AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')
        ) AS monthly_registrations,
        (
          SELECT COUNT(*)
          FROM payments
          WHERE status='PENDING'
            OR status='NEEDS_CORRECTION'
        ) AS pending_payments,
        (
          SELECT COALESCE(SUM(amount),0)
          FROM payments
          WHERE status='APPROVED'
        ) AS approved_revenue,
        (
          SELECT COUNT(*)
          FROM users
          WHERE status='ACTIVE' AND deleted_at IS NULL
        ) AS active_users
    `),
    queryRows<RecentRegistrationRow[]>(`
      SELECT
        r.id,
        COALESCE(
          u.name,
          MIN(COALESCE(p.name,tp.name,tm.title)),
          'مهمان'
        ) AS name,
        t.title AS tournament,
        r.status,
        r.payable_amount AS amount,
        r.created_at
      FROM registrations r
      JOIN tournaments t ON t.id=r.tournament_id
      LEFT JOIN users u ON u.id=r.buyer_user_id
      LEFT JOIN registration_entries re ON re.registration_id=r.id
      LEFT JOIN players p ON p.id=re.player_id
      LEFT JOIN teams tm ON tm.id=re.team_id
      LEFT JOIN team_members tmem ON tmem.team_id=tm.id
      LEFT JOIN players tp ON tp.id=tmem.player_id
      WHERE r.deleted_at IS NULL
      GROUP BY r.id
      ORDER BY r.created_at DESC,r.id DESC
      LIMIT 8
    `),
    queryRows<RecentPaymentRow[]>(`
      SELECT
        p.id,
        COALESCE(p.payer_name,u.name,'مهمان') AS payer_name,
        t.title AS tournament,
        p.method,
        p.status,
        p.amount,
        p.submitted_at,
        p.created_at
      FROM payments p
      JOIN registrations r ON r.id=p.registration_id
      JOIN tournaments t ON t.id=r.tournament_id
      LEFT JOIN users u ON u.id=COALESCE(p.user_id,r.buyer_user_id)
      ORDER BY COALESCE(p.submitted_at,p.created_at) DESC,p.id DESC
      LIMIT 6
    `)
  ]);

  const stats = statsRows[0];

  return {
    stats: [
      {
        title: "مسابقات فعال",
        value: String(stats.active_tournaments),
        hint: "منتشرشده و در حال اجرا",
        trend: ""
      },
      {
        title: "ثبت‌نام‌های ماه",
        value: String(stats.monthly_registrations),
        hint: `${Number(stats.pending_payments).toLocaleString("fa-IR")} پرداخت نیازمند رسیدگی`,
        trend: ""
      },
      {
        title: "درآمد تأییدشده",
        value: Number(stats.approved_revenue).toLocaleString("fa-IR"),
        hint: "تومان",
        trend: ""
      },
      {
        title: "کاربران فعال",
        value: String(stats.active_users),
        hint: "حساب فعال",
        trend: ""
      }
    ],
    pendingPaymentCount: Number(stats.pending_payments),
    recentRegistrations: recentRegistrationRows.map((row) => ({
      id: String(row.id),
      name: row.name,
      tournament: row.tournament,
      status: registrationStatusTitle(row.status),
      amount: Number(row.amount).toLocaleString("fa-IR"),
      createdAt: new Date(row.created_at).toISOString()
    })),
    recentPayments: recentPaymentRows.map((row) => ({
      id: String(row.id),
      payerName: row.payer_name,
      tournament: row.tournament,
      method: paymentMethodTitle(row.method),
      status: paymentStatusTitle(row.status, row.method),
      amount: Number(row.amount).toLocaleString("fa-IR"),
      createdAt: new Date(row.submitted_at || row.created_at).toISOString()
    }))
  };
}

export async function getPendingPaymentCount() {
  const rows = await queryRows<(RowDataPacket & { count: number })[]>(`
    SELECT COUNT(*) AS count
    FROM payments
    WHERE status='PENDING' OR status='NEEDS_CORRECTION'
  `);
  return Number(rows[0]?.count || 0);
}
