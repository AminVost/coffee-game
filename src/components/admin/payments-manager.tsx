/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatToman } from "@/lib/utils";

type PaymentItem = {
  id: string;
  payerName: string;
  tournamentTitle: string;
  method: string;
  amount: number;
  status: string;
  rejectedReason?: string | null;
  receiptUrl: string | null;
};

const statusTitle: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تاییدشده",
  REJECTED: "ردشده",
  EXPIRED: "منقضی",
  CANCELLED: "لغوشده",
  REFUNDED: "بازگشت وجه"
};

const methodTitle: Record<string, string> = { online: "درگاه", mock: "درگاه آزمایشی", cash: "حضوری", receipt: "فیش بانکی" };

export function PaymentsManager() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/payments", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت پرداخت‌ها انجام نشد.");
    setItems(payload.items || []);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.payerName} ${item.tournamentTitle} ${item.status}`.toLowerCase().includes(needle));
  }, [items, query]);

  async function update(id: string, action: "approve" | "reject") {
    let reason = "";
    if (action === "reject") {
      reason = window.prompt("دلیل رد فیش را وارد کنید:", "اطلاعات فیش قابل تایید نیست.")?.trim() || "";
      if (!reason) return;
    }
    setBusyId(id);
    setError("");
    const response = await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { action } : { action, reason })
    });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "تغییر وضعیت پرداخت انجام نشد.");
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: payload.status, rejectedReason: reason || null } : item));
  }

  return <>
    <label className="mt-6 flex h-12 max-w-md items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4"><Search size={17} className="text-[var(--muted)]"/><input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="پرداخت‌کننده یا مسابقه..." value={query} onChange={(event) => setQuery(event.target.value)}/></label>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <Card className="mt-5 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm"><thead className="bg-[var(--surface-2)]"><tr><th className="p-4">پرداخت‌کننده</th><th className="p-4">مسابقه</th><th className="p-4">روش</th><th className="p-4">مبلغ</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead><tbody>
      {filtered.map((item) => <tr key={item.id} className="border-t border-[var(--line)]"><td className="p-4 font-bold">{item.payerName}</td><td className="p-4">{item.tournamentTitle}</td><td className="p-4 text-[var(--muted)]">{methodTitle[item.method] || item.method}</td><td className="p-4">{formatToman(item.amount)}</td><td className="p-4">{statusTitle[item.status] || item.status}{item.rejectedReason && <span className="block max-w-xs text-xs text-red-500">{item.rejectedReason}</span>}</td><td className="p-4"><div className="flex gap-2">
        {item.receiptUrl && <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)]" title="مشاهده فیش"><Eye size={15}/></a>}
        {!['APPROVED','REFUNDED','CANCELLED'].includes(item.status) && <button disabled={busyId === item.id} onClick={() => update(item.id,"approve")} className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-emerald-500/12 text-emerald-500 disabled:opacity-50" title="تایید"><Check size={15}/></button>}
        {!['APPROVED','REFUNDED','CANCELLED'].includes(item.status) && <button disabled={busyId === item.id} onClick={() => update(item.id,"reject")} className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-red-500/12 text-red-500 disabled:opacity-50" title="رد"><X size={15}/></button>}
      </div></td></tr>)}
      {!loading && !filtered.length && <tr><td colSpan={6} className="p-10 text-center text-[var(--muted)]">پرداختی پیدا نشد.</td></tr>}
      {loading && <tr><td colSpan={6} className="p-10 text-center text-[var(--muted)]">در حال دریافت...</td></tr>}
    </tbody></table></div></Card>
  </>;
}
