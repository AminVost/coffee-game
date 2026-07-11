/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Search, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  return (
    <>
      <label className="relative mt-6 block max-w-md">
        <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
        <Input className="pr-11" placeholder="پرداخت‌کننده یا مسابقه..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-right text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-4">پرداخت‌کننده</th><th className="p-4">مسابقه</th><th className="p-4">روش</th><th className="p-4">مبلغ</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead>
            <tbody>
              {filtered.map((item) => <tr key={item.id} className="border-t border-[var(--line)]">
                <td className="p-4 font-bold">{item.payerName}</td>
                <td className="p-4">{item.tournamentTitle}</td>
                <td className="p-4 text-[var(--muted)]">{methodTitle[item.method] || item.method}</td>
                <td className="p-4">{formatToman(item.amount)}</td>
                <td className="p-4">{statusTitle[item.status] || item.status}{item.rejectedReason && <span className="block max-w-xs text-xs text-red-500">{item.rejectedReason}</span>}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    {item.receiptUrl && <Button href={item.receiptUrl} target="_blank" rel="noreferrer" variant="secondary" size="iconSm" aria-label="مشاهده فیش"><Eye size={15} /></Button>}
                    {!['APPROVED', 'REFUNDED', 'CANCELLED'].includes(item.status) && <Button type="button" disabled={busyId === item.id} onClick={() => update(item.id, "approve")} variant="soft" size="iconSm" aria-label="تایید پرداخت"><Check size={15} /></Button>}
                    {!['APPROVED', 'REFUNDED', 'CANCELLED'].includes(item.status) && <Button type="button" disabled={busyId === item.id} onClick={() => update(item.id, "reject")} variant="dangerSoft" size="iconSm" aria-label="رد پرداخت"><X size={15} /></Button>}
                  </div>
                </td>
              </tr>)}
              {!loading && !filtered.length && <tr><td colSpan={6} className="p-10 text-center text-[var(--muted)]">پرداختی پیدا نشد.</td></tr>}
              {loading && <tr><td colSpan={6} className="p-10 text-center text-[var(--muted)]">در حال دریافت...</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
