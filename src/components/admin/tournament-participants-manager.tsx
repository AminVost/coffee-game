/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ListChecks, RefreshCcw, ShieldAlert, UsersRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const registrationStatusTitle: Record<string, string> = {
  RESERVED: "رزروشده",
  PENDING_PAYMENT: "در انتظار پرداخت",
  PENDING_APPROVAL: "در انتظار تأیید",
  NEEDS_CORRECTION: "نیازمند اصلاح",
  CONFIRMED: "قطعی",
  CHECKED_IN: "حاضر"
};

const paymentStatusTitle: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  NEEDS_CORRECTION: "نیازمند اصلاح",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  EXPIRED: "منقضی‌شده"
};

type Entry = {
  id: number;
  playerId: number | null;
  teamId: number | null;
  name: string;
  mobile: string | null;
  seed: number | null;
  teamMemberCount: number;
  teamMemberNames: string[];
};

type Registration = {
  id: number;
  publicId: string;
  status: string;
  slots: number;
  contactMobile: string | null;
  paymentStatus: string | null;
  entries: Entry[];
};

type Inspection = {
  tournament: {
    id: number;
    title: string;
    status: string;
    participantType: "INDIVIDUAL" | "TEAM";
    teamSize: number;
    capacity: number;
    minimumParticipants: number;
  };
  finalRegistrations: Registration[];
  pendingRegistrations: Registration[];
  finalUnits: number;
  pendingCount: number;
  activeHolds: number;
  activeWaitlist: number;
  drawExists: boolean;
  blockers: Array<{ code: string; message: string }>;
  readyForDraw: boolean;
};

const autoResolvedCodes = new Set(["ACTIVE_HOLDS", "ACTIVE_WAITLIST"]);

function participantName(registration: Registration) {
  return registration.entries.map((entry) => entry.name).filter(Boolean).join("، ") || "بدون نام";
}

function participantDetails(registration: Registration) {
  const members = registration.entries.flatMap((entry) => entry.teamMemberNames || []);
  if (members.length) return members.join("، ");
  const mobiles = registration.entries.map((entry) => entry.mobile).filter(Boolean);
  return mobiles.join("، ") || registration.contactMobile || "—";
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function TournamentParticipantsManager({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/participants`, { cache: "no-store" });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        setData(null);
        setError(String(payload.message || "دریافت اطلاعات شرکت‌کنندگان انجام نشد."));
        return;
      }
      setData(payload as unknown as Inspection);
    } catch {
      setData(null);
      setError("ارتباط با سرور برای دریافت شرکت‌کنندگان برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tournamentId]);

  const hardBlockers = useMemo(
    () => data?.blockers.filter((item) => !autoResolvedCodes.has(item.code)) || [],
    [data]
  );
  const cleanupWarnings = useMemo(
    () => data?.blockers.filter((item) => autoResolvedCodes.has(item.code)) || [],
    [data]
  );

  async function finalize() {
    if (!data) return;
    const cleanupText = cleanupWarnings.length
      ? " رزروهای موقت و صف انتظار فعال نیز بسته می‌شوند."
      : "";
    if (!window.confirm(`فهرست ${data.finalUnits.toLocaleString("fa-IR")} شرکت‌کننده نهایی شود؟${cleanupText}`)) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/participants`, { method: "POST" });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        const blockers = Array.isArray(payload.blockers)
          ? payload.blockers as Array<{ message?: string }>
          : [];
        const blockerText = blockers.map((item) => item.message).filter(Boolean).join(" ");
        setError(`${String(payload.message || "نهایی‌سازی انجام نشد.")}${blockerText ? ` ${blockerText}` : ""}`);
        return;
      }
      setData(payload.inspection as Inspection);
      setMessage("فهرست شرکت‌کنندگان نهایی شد و مسابقه آماده ورود به مرحله قرعه است.");
    } catch {
      setError("ارتباط با سرور برای نهایی‌سازی شرکت‌کنندگان برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Card className="mt-7 p-8 text-center text-[var(--muted)]">در حال بررسی ثبت‌نام‌ها...</Card>;
  if (!data) return <Alert tone="error" className="mt-7">اطلاعات مسابقه دریافت نشد.</Alert>;

  const unitTitle = data.tournament.participantType === "TEAM" ? "تیم" : "نفر";

  return (
    <div className="mt-7 space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{data.tournament.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              وضعیت فعلی: <strong>{data.tournament.status}</strong>
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            <RefreshCcw size={16} />بازبینی دوباره
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-[var(--surface-2)] p-4">
            <UsersRound size={20} className="text-[var(--brand)]" />
            <strong className="mt-3 block text-2xl">{data.finalUnits.toLocaleString("fa-IR")}</strong>
            <span className="text-xs text-[var(--muted)]">{unitTitle} قطعی</span>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] p-4">
            <ListChecks size={20} className="text-emerald-500" />
            <strong className="mt-3 block text-2xl">{data.tournament.minimumParticipants.toLocaleString("fa-IR")}</strong>
            <span className="text-xs text-[var(--muted)]">حداقل لازم</span>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] p-4">
            <Clock3 size={20} className="text-amber-500" />
            <strong className="mt-3 block text-2xl">{data.pendingCount.toLocaleString("fa-IR")}</strong>
            <span className="text-xs text-[var(--muted)]">ثبت‌نام تعیین‌تکلیف‌نشده</span>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] p-4">
            <CheckCircle2 size={20} className="text-sky-500" />
            <strong className="mt-3 block text-2xl">{data.tournament.capacity.toLocaleString("fa-IR")}</strong>
            <span className="text-xs text-[var(--muted)]">ظرفیت کل</span>
          </div>
        </div>
      </Card>

      {hardBlockers.map((blocker) => <Alert key={blocker.code} tone="error"><ShieldAlert className="ml-2 inline" size={16} />{blocker.message}</Alert>)}
      {cleanupWarnings.map((warning) => <Alert key={warning.code} tone="warning">{warning.message} با نهایی‌سازی، این موارد بسته می‌شوند.</Alert>)}
      {data.readyForDraw && <Alert tone="success">فهرست نهایی است و می‌توانی وارد مدیریت قرعه شوی.</Alert>}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="font-black">فهرست نهایی پیشنهادی</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">فقط ثبت‌نام‌های قطعی با پرداخت تأییدشده وارد قرعه می‌شوند.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-4">شرکت‌کننده</th><th className="p-4">جزئیات</th><th className="p-4">ثبت‌نام</th><th className="p-4">پرداخت</th><th className="p-4">Seed</th></tr></thead>
            <tbody>
              {data.finalRegistrations.map((registration) => <tr key={registration.id} className="border-t border-[var(--line)]">
                <td className="p-4 font-bold">{participantName(registration)}</td>
                <td className="p-4 text-xs text-[var(--muted)]">{participantDetails(registration)}</td>
                <td className="p-4">{registrationStatusTitle[registration.status] || registration.status}</td>
                <td className="p-4">{paymentStatusTitle[registration.paymentStatus || ""] || registration.paymentStatus || "—"}</td>
                <td className="p-4">{registration.entries.map((entry) => entry.seed).filter((seed) => seed !== null).join("، ") || "—"}</td>
              </tr>)}
              {!data.finalRegistrations.length && <tr><td colSpan={5} className="p-8 text-center text-[var(--muted)]">ثبت‌نام قطعی وجود ندارد.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {data.pendingRegistrations.length > 0 && <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5">
          <div><h2 className="font-black">موارد نیازمند تعیین تکلیف</h2><p className="mt-1 text-xs text-[var(--muted)]">قبل از نهایی‌سازی باید پرداخت این ثبت‌نام‌ها بررسی شود.</p></div>
          <Button href="/admin/payments" variant="secondary">رفتن به پرداخت‌ها</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-right text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-4">شرکت‌کننده</th><th className="p-4">وضعیت ثبت‌نام</th><th className="p-4">وضعیت پرداخت</th><th className="p-4">موبایل</th></tr></thead>
            <tbody>{data.pendingRegistrations.map((registration) => <tr key={registration.id} className="border-t border-[var(--line)]"><td className="p-4 font-bold">{participantName(registration)}</td><td className="p-4">{registrationStatusTitle[registration.status] || registration.status}</td><td className="p-4">{paymentStatusTitle[registration.paymentStatus || ""] || registration.paymentStatus || "—"}</td><td className="p-4" dir="ltr">{registration.contactMobile || "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>}

      <Card className="p-5 sm:p-7">
        <h2 className="font-black">اقدام نهایی</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          این عملیات ثبت‌نام را می‌بندد، رزروهای موقت و صف انتظار فعال را خاتمه می‌دهد و فهرست قطعی را برای قرعه آماده می‌کند. پرداخت قطعی یا شرکت‌کننده‌ای حذف نمی‌شود.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={busy || hardBlockers.length > 0 || data.drawExists || data.readyForDraw}
            loading={busy}
            onClick={finalize}
          >
            <CheckCircle2 size={17} />نهایی‌سازی شرکت‌کنندگان
          </Button>
          {data.readyForDraw && <Button href={`/admin/tournaments/${tournamentId}/draw`} variant="secondary">رفتن به قرعه</Button>}
        </div>
      </Card>
    </div>
  );
}
