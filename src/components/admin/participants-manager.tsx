/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserCheck, UserX, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";

type RegistrationItem = {
  id: string;
  tournamentTitle: string;
  status: string;
  slots: number;
  names: string;
  mobiles: string;
  checkedInAt: string | null;
};

const statusTitle: Record<string, string> = {
  CONFIRMED: "تاییدشده",
  CHECKED_IN: "حاضر",
  NO_SHOW: "عدم حضور",
  PENDING_PAYMENT: "در انتظار پرداخت",
  PENDING_APPROVAL: "در انتظار تایید",
  WAITLISTED: "لیست انتظار"
};

export function ParticipantsManager() {
  const [items, setItems] = useState<RegistrationItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/registrations", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.message || "دریافت شرکت‌کنندگان انجام نشد.");
      return;
    }
    setItems(payload.items || []);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.names} ${item.mobiles} ${item.tournamentTitle}`.toLowerCase().includes(needle));
  }, [items, query]);

  async function changeStatus(id: string, status: "CONFIRMED" | "CHECKED_IN" | "NO_SHOW") {
    setBusyId(id);
    setError("");
    const response = await fetch(`/api/admin/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) {
      setError(payload.message || "تغییر وضعیت انجام نشد.");
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      status,
      checkedInAt: status === "CHECKED_IN" ? new Date().toISOString() : null
    } : item));
  }

  return <div>
    <div className="mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4">
      <Search size={17} className="text-[var(--muted)]"/>
      <input className="h-12 flex-1 bg-transparent outline-none" placeholder="نام، موبایل یا مسابقه..." value={query} onChange={(event) => setQuery(event.target.value)}/>
    </div>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <Card className="mt-5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-right text-sm">
          <thead className="bg-[var(--surface-2)]"><tr><th className="p-4">شرکت‌کننده</th><th className="p-4">مسابقه</th><th className="p-4">سهم</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead>
          <tbody>
            {filtered.map((item) => <tr key={item.id} className="border-t border-[var(--line)]">
              <td className="p-4 font-bold">{item.names}<span className="block text-xs font-normal text-[var(--muted)]" dir="ltr">{item.mobiles}</span></td>
              <td className="p-4">{item.tournamentTitle}</td>
              <td className="p-4">{item.slots.toLocaleString("fa-IR")}</td>
              <td className="p-4">{statusTitle[item.status] || item.status}</td>
              <td className="p-4"><div className="flex flex-wrap gap-2">
                {item.status !== "CHECKED_IN" && <button disabled={busyId === item.id} onClick={() => changeStatus(item.id, "CHECKED_IN")} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500/12 px-3 py-2 text-xs font-bold text-emerald-600 disabled:opacity-50"><UserCheck size={15}/>ثبت حضور</button>}
                {item.status !== "NO_SHOW" && <button disabled={busyId === item.id} onClick={() => changeStatus(item.id, "NO_SHOW")} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-xs font-bold text-amber-600 disabled:opacity-50"><UserX size={15}/>عدم حضور</button>}
                {["CHECKED_IN","NO_SHOW"].includes(item.status) && <button disabled={busyId === item.id} onClick={() => changeStatus(item.id, "CONFIRMED")} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-bold disabled:opacity-50"><Undo2 size={15}/>بازگردانی</button>}
              </div></td>
            </tr>)}
            {!loading && !filtered.length && <tr><td colSpan={5} className="p-10 text-center text-[var(--muted)]">موردی پیدا نشد.</td></tr>}
            {loading && <tr><td colSpan={5} className="p-10 text-center text-[var(--muted)]">در حال دریافت...</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  </div>;
}
