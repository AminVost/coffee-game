import { ArrowLeft, Plus, WalletCards } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminDashboardData } from "@/lib/repositories/admin-dashboard";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function AdminDashboard() {
  const data = await getAdminDashboardData();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">ADMIN OVERVIEW</p>
          <h1 className="section-title mt-2">داشبورد مدیریت</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            خلاصه وضعیت واقعی ثبت‌نام‌ها و پرداخت‌ها
          </p>
        </div>
        <Button href="/admin/tournaments/new"><Plus size={17} />مسابقه جدید</Button>
      </div>

      {data.pendingPaymentCount > 0 && (
        <Card className="mt-6 border-amber-500/25 bg-amber-500/8 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
                <WalletCards size={20} />
              </span>
              <div>
                <strong>
                  {data.pendingPaymentCount.toLocaleString("fa-IR")} پرداخت نیازمند رسیدگی
                </strong>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  پرداخت‌های جدید و موارد نیازمند اصلاح را بررسی کنید.
                </p>
              </div>
            </div>
            <Button href="/admin/payments" variant="secondary">
              رفتن به صندوق پرداخت‌ها
              <ArrowLeft size={15} />
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => <StatCard key={stat.title} stat={stat} />)}
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="font-black">ثبت‌نام‌های اخیر</h2>
            <Button href="/admin/participants" variant="ghost" size="sm">
              همه <ArrowLeft size={15} />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="p-4">نام</th>
                  <th className="p-4">مسابقه</th>
                  <th className="p-4">وضعیت</th>
                  <th className="p-4">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRegistrations.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--line)]">
                    <td className="p-4 font-bold">
                      {item.name}
                      <span className="mt-1 block text-[11px] font-normal text-[var(--muted)]">
                        {formatDate(item.createdAt)}
                      </span>
                    </td>
                    <td className="p-4 text-[var(--muted)]">{item.tournament}</td>
                    <td className="p-4">{item.status}</td>
                    <td className="p-4">{item.amount}</td>
                  </tr>
                ))}
                {!data.recentRegistrations.length && (
                  <tr><td colSpan={4} className="p-10 text-center text-[var(--muted)]">ثبت‌نامی وجود ندارد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="font-black">آخرین پرداخت‌ها</h2>
            <Button href="/admin/payments" variant="ghost" size="sm">
              همه <ArrowLeft size={15} />
            </Button>
          </div>
          <div className="grid">
            {data.recentPayments.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] p-4 first:border-t-0"
              >
                <div>
                  <strong className="text-sm">{item.payerName}</strong>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.tournament} · {item.method}
                  </p>
                </div>
                <div className="text-left">
                  <strong className="block text-sm text-[var(--brand)]">{item.amount}</strong>
                  <span className="mt-1 block text-[11px] text-[var(--muted)]">
                    {item.status} · {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            ))}
            {!data.recentPayments.length && (
              <div className="p-10 text-center text-[var(--muted)]">پرداختی وجود ندارد.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
