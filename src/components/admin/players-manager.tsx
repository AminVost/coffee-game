"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserRound,
  Users,
  X
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PlayerItem = {
  id: string;
  userId: string | null;
  name: string;
  mobile: string | null;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  accountStatus: string;
  mobileVerified: boolean;
  emailVerified: boolean;
  registrationCount: number;
  tournamentCount: number;
  teamCount: number;
  totalPoints: number;
  rankingPlayed: number;
  rankingWins: number;
  lastTournamentTitle: string | null;
  lastRegistrationAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Overview = {
  total: number;
  members: number;
  guests: number;
  activeAccounts: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const emptyOverview: Overview = { total: 0, members: 0, guests: 0, activeAccounts: 0 };
const emptyPagination: Pagination = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

const statusLabels: Record<string, string> = {
  ACTIVE: "فعال",
  PENDING: "در انتظار",
  SUSPENDED: "مسدود",
  DELETED: "حذف‌شده",
  GUEST: "مهمان"
};

function statusTone(status: string): "green" | "gold" | "red" | "blue" | "neutral" {
  if (status === "ACTIVE") return "green";
  if (status === "PENDING") return "gold";
  if (status === "SUSPENDED" || status === "DELETED") return "red";
  if (status === "GUEST") return "blue";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

function StatBox({ icon: Icon, title, value, hint }: {
  icon: typeof Users;
  title: string;
  value: number;
  hint: string;
}) {
  return <Card className="p-4 sm:p-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-bold text-[var(--muted)]">{title}</p>
        <strong className="mt-2 block text-2xl font-black">{formatNumber(value)}</strong>
        <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>
      </div>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand)]/12 text-[var(--brand)]">
        <Icon size={20}/>
      </span>
    </div>
  </Card>;
}

function PlayerAvatar({ player, size = "md" }: { player: PlayerItem; size?: "md" | "lg" }) {
  const classes = size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm";

  if (player.avatarUrl) {
    return <span
      role="img"
      aria-label={player.name}
      className={cn("shrink-0 rounded-2xl bg-cover bg-center", classes)}
      style={{ backgroundImage: `url(${player.avatarUrl})` }}
    />;
  }

  return <span className={cn(
    "grid shrink-0 place-items-center rounded-2xl bg-[var(--brand)]/12 font-black text-[var(--brand)]",
    classes
  )}>
    {player.name.trim().charAt(0) || "ب"}
  </span>;
}

function PlayerDetails({ player, onClose }: { player: PlayerItem; onClose: () => void }) {
  const details = [
    ["شماره بازیکن", player.id],
    ["شماره حساب کاربری", player.userId || "ندارد"],
    ["موبایل", player.mobile || "ثبت نشده"],
    ["ایمیل", player.email || "ثبت نشده"],
    ["نوع بازیکن", player.isGuest ? "مهمان" : "عضو دارای حساب"],
    ["وضعیت حساب", statusLabels[player.accountStatus] || player.accountStatus],
    ["تأیید موبایل", player.mobileVerified ? "تأییدشده" : "تأییدنشده"],
    ["تأیید ایمیل", player.emailVerified ? "تأییدشده" : "تأییدنشده"],
    ["تعداد ثبت‌نام", formatNumber(player.registrationCount)],
    ["مسابقات متفاوت", formatNumber(player.tournamentCount)],
    ["تعداد تیم‌ها", formatNumber(player.teamCount)],
    ["امتیاز کل رنکینگ", formatNumber(player.totalPoints)],
    ["بازی ثبت‌شده در رنکینگ", formatNumber(player.rankingPlayed)],
    ["برد ثبت‌شده", formatNumber(player.rankingWins)],
    ["آخرین مسابقه", player.lastTournamentTitle || "هنوز ثبت‌نامی ندارد"],
    ["آخرین ثبت‌نام", formatDate(player.lastRegistrationAt)],
    ["تاریخ ایجاد بازیکن", formatDate(player.createdAt)],
    ["آخرین بروزرسانی", formatDate(player.updatedAt)]
  ];

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
    <Button type="button" aria-label="بستن جزئیات" variant="ghost" className="absolute inset-0 h-auto w-auto rounded-none p-0" onClick={onClose} />
    <Card className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-b-none p-5 sm:rounded-[1.75rem] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg"/>
          <div>
            <h2 className="text-xl font-black">{player.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={player.isGuest ? "blue" : "green"}>{player.isGuest ? "مهمان" : "عضو"}</Badge>
              <Badge tone={statusTone(player.accountStatus)}>{statusLabels[player.accountStatus] || player.accountStatus}</Badge>
            </div>
          </div>
        </div>
        <Button type="button" onClick={onClose} variant="secondary" size="iconSm" aria-label="بستن">
          <X size={18}/>
        </Button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="rounded-2xl bg-[var(--surface-2)] p-4">
          <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
          <p className="mt-2 break-words text-sm font-bold">{value}</p>
        </div>)}
      </div>
    </Card>
  </div>;
}

export function PlayersManager() {
  const [items, setItems] = useState<PlayerItem[]>([]);
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PlayerItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        search: debouncedSearch,
        type,
        status,
        page: String(page),
        pageSize: "20"
      });

      try {
        const response = await fetch(`/api/admin/players?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = await response.json();

        if (!response.ok) {
          setError(payload.message || "دریافت فهرست بازیکنان انجام نشد.");
          return;
        }

        setItems(payload.items || []);
        setOverview(payload.overview || emptyOverview);
        setPagination(payload.pagination || emptyPagination);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError("ارتباط با سرور برای دریافت بازیکنان برقرار نشد.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [debouncedSearch, type, status, page]);

  const rangeText = useMemo(() => {
    if (!pagination.total) return "۰ بازیکن";
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
    return `${formatNumber(start)} تا ${formatNumber(end)} از ${formatNumber(pagination.total)}`;
  }, [pagination]);

  function changeType(value: string) {
    setType(value);
    setPage(1);
  }

  function changeStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  return <>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatBox icon={Users} title="کل بازیکنان" value={overview.total} hint="تمام پروفایل‌های ثبت‌شده"/>
      <StatBox icon={UserCheck} title="اعضای دارای حساب" value={overview.members} hint="متصل به حساب کاربری"/>
      <StatBox icon={UserRound} title="بازیکنان مهمان" value={overview.guests} hint="ثبت‌شده بدون حساب"/>
      <StatBox icon={ShieldCheck} title="حساب‌های فعال" value={overview.activeAccounts} hint="کاربران قابل ورود"/>
    </div>

    <Card className="mt-5 p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17}/>
          <Input
            className="pr-11"
            placeholder="جستجو با نام، موبایل یا ایمیل..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <SelectField
          value={type}
          onValueChange={changeType}
          options={[
            { value: "all", label: "همه نوع‌ها" },
            { value: "member", label: "اعضای دارای حساب" },
            { value: "guest", label: "بازیکنان مهمان" }
          ]}
        />

        <SelectField
          value={status}
          onValueChange={changeStatus}
          options={[
            { value: "all", label: "همه وضعیت‌ها" },
            { value: "ACTIVE", label: "فعال" },
            { value: "PENDING", label: "در انتظار" },
            { value: "SUSPENDED", label: "مسدود" },
            { value: "GUEST", label: "بدون حساب" }
          ]}
        />
      </div>
    </Card>

    {error && <Alert tone="error" className="mt-4">{error}</Alert>}

    <Card className="mt-5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-right text-sm">
          <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
            <tr>
              <th className="p-4">بازیکن</th>
              <th className="p-4">نوع و وضعیت</th>
              <th className="p-4">فعالیت مسابقات</th>
              <th className="p-4">تیم‌ها</th>
              <th className="p-4">رنکینگ</th>
              <th className="p-4">آخرین مسابقه</th>
              <th className="p-4">عضویت</th>
              <th className="p-4">جزئیات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((player) => <tr key={player.id} className="border-t border-[var(--line)] transition hover:bg-[var(--surface-2)]/55">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <PlayerAvatar player={player}/>
                  <div>
                    <strong className="block">{player.name}</strong>
                    <span className="mt-1 block text-xs text-[var(--muted)]" dir="ltr">{player.mobile || "بدون موبایل"}</span>
                    {player.email && <span className="mt-1 block max-w-[210px] truncate text-xs text-[var(--muted)]" dir="ltr">{player.email}</span>}
                  </div>
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={player.isGuest ? "blue" : "green"}>{player.isGuest ? "مهمان" : "عضو"}</Badge>
                  <Badge tone={statusTone(player.accountStatus)}>{statusLabels[player.accountStatus] || player.accountStatus}</Badge>
                </div>
              </td>
              <td className="p-4">
                <strong>{formatNumber(player.registrationCount)} ثبت‌نام</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">{formatNumber(player.tournamentCount)} مسابقه متفاوت</span>
              </td>
              <td className="p-4">{formatNumber(player.teamCount)}</td>
              <td className="p-4">
                <div className="flex items-center gap-2 font-bold"><Trophy size={15} className="text-amber-500"/>{formatNumber(player.totalPoints)} امتیاز</div>
                <span className="mt-1 block text-xs text-[var(--muted)]">{formatNumber(player.rankingWins)} برد از {formatNumber(player.rankingPlayed)} بازی</span>
              </td>
              <td className="p-4">
                <span className="block max-w-[200px] truncate font-bold">{player.lastTournamentTitle || "بدون سابقه"}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">{formatDate(player.lastRegistrationAt)}</span>
              </td>
              <td className="p-4 text-[var(--muted)]">{formatDate(player.createdAt)}</td>
              <td className="p-4">
                <Button type="button" onClick={() => setSelected(player)} variant="secondary" size="sm">
                  <Eye size={15}/>
                  مشاهده
                </Button>
              </td>
            </tr>)}

            {loading && <tr><td colSpan={8} className="p-12 text-center text-[var(--muted)]">
              <Activity className="mx-auto mb-3 animate-pulse" size={24}/>
              در حال دریافت بازیکنان...
            </td></tr>}

            {!loading && !items.length && <tr><td colSpan={8} className="p-12 text-center text-[var(--muted)]">
              بازیکنی با فیلترهای انتخاب‌شده پیدا نشد.
            </td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-bold text-[var(--muted)]">{rangeText}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="iconSm" disabled={pagination.page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="صفحه قبل">
            <ChevronRight size={17}/>
          </Button>
          <span className="min-w-24 text-center text-xs font-bold">
            صفحه {formatNumber(pagination.page)} از {formatNumber(pagination.totalPages)}
          </span>
          <Button type="button" variant="secondary" size="iconSm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} aria-label="صفحه بعد">
            <ChevronLeft size={17}/>
          </Button>
        </div>
      </div>
    </Card>

    {selected && <PlayerDetails player={selected} onClose={() => setSelected(null)}/>}
  </>;
}
