import { Bell, CalendarDays, QrCode, Trophy, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getAccountDashboardData } from "@/lib/repositories/account-dashboard";

function formatMatchTime(value: string | null) {
  if (!value) return "زمان اعلام نشده";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function Account() {
  const user = await getSession();
  if (!user) redirect("/login");
  const data = await getAccountDashboardData(user.id);

  const stats = [
    ["ثبت‌نام‌های فعال", data.activeRegistrations.toLocaleString("fa-IR"), Trophy],
    ["QR آماده", data.readyQr.toLocaleString("fa-IR"), QrCode],
    ["پرداخت نیازمند رسیدگی", data.pendingPayments.toLocaleString("fa-IR"), WalletCards],
    ["اعلان خوانده‌نشده", data.unreadNotifications.toLocaleString("fa-IR"), Bell]
  ] as const;

  return <div>
    <p className="section-kicker">PLAYER AREA</p>
    <h1 className="section-title mt-2">داشبورد بازیکن</h1>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([title, value, Icon]) => <Card key={title} className="p-5">
        <Icon className="text-[var(--brand)]" />
        <p className="mt-4 text-xs text-[var(--muted)]">{title}</p>
        <strong className="mt-2 block text-xl">{value}</strong>
      </Card>)}
    </div>

    <Card className="mt-6 p-6">
      <h2 className="text-xl font-black">بازی بعدی شما</h2>
      {data.nextMatch ? <div className="mt-5 rounded-2xl bg-[var(--surface-2)] p-5">
        <p className="text-xs text-[var(--muted)]">
          {data.nextMatch.tournamentTitle} · {data.nextMatch.roundTitle}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <strong>شما مقابل {data.nextMatch.opponentName}</strong>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-black text-white">
            <CalendarDays size={16} />
            {data.nextMatch.resourceTitle} · {formatMatchTime(data.nextMatch.scheduledAt)}
          </span>
        </div>
      </div> : <p className="mt-5 rounded-2xl bg-[var(--surface-2)] p-5 text-sm text-[var(--muted)]">
        در حال حاضر بازی زمان‌بندی‌شده‌ای برای شما وجود ندارد.
      </p>}
    </Card>
  </div>;
}
