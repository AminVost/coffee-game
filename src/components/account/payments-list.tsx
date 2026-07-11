/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatToman } from "@/lib/utils";

type PaymentItem = { id: string; publicId: string; tournamentTitle: string; amount: number; method: string; status: string; rejectedReason: string | null; receiptUrl: string | null };
const statusTitle: Record<string,string> = { PENDING:"در انتظار پرداخت",APPROVED:"تاییدشده",REJECTED:"ردشده",EXPIRED:"منقضی",CANCELLED:"لغوشده",REFUNDED:"بازگشت وجه" };

export function PaymentsList() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedPaymentRef = useRef<PaymentItem | null>(null);

  async function load() {
    const response = await fetch("/api/account/payments", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت پرداخت‌ها انجام نشد.");
    setItems(payload.items || []);
  }
  useEffect(() => { void load(); }, []);

  function chooseFile(payment: PaymentItem) {
    selectedPaymentRef.current = payment;
    inputRef.current?.click();
  }

  async function upload(file: File | undefined) {
    const payment = selectedPaymentRef.current;
    if (!file || !payment) return;
    setBusyId(payment.id);
    setError("");
    const form = new FormData();
    form.set("paymentId", payment.publicId);
    form.set("file", file);
    const response = await fetch("/api/payments/receipts", { method: "POST", body: form });
    const payload = await response.json();
    setBusyId("");
    if (!response.ok) return setError(payload.message || "آپلود فیش انجام نشد.");
    await load();
  }

  return <>
    <input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <Card className="mt-7 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead className="bg-[var(--surface-2)]"><tr><th className="p-4">مسابقه</th><th className="p-4">مبلغ</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id} className="border-t border-[var(--line)]"><td className="p-4 font-bold">{item.tournamentTitle}</td><td className="p-4">{formatToman(item.amount)}</td><td className="p-4">{statusTitle[item.status] || item.status}{item.rejectedReason && <span className="block text-xs text-red-500">{item.rejectedReason}</span>}</td><td className="p-4"><div className="flex gap-2">{item.receiptUrl && <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-bold"><Eye size={15}/>مشاهده</a>}{!['APPROVED','REFUNDED','CANCELLED'].includes(item.status) && <Button size="sm" variant="secondary" disabled={busyId === item.id} onClick={() => chooseFile(item)}><Upload size={15}/>{busyId === item.id ? "در حال آپلود" : "آپلود فیش"}</Button>}</div></td></tr>)}
      {!loading && !items.length && <tr><td colSpan={4} className="p-10 text-center text-[var(--muted)]">پرداختی وجود ندارد.</td></tr>}
      {loading && <tr><td colSpan={4} className="p-10 text-center text-[var(--muted)]">در حال دریافت...</td></tr>}
    </tbody></table></div></Card>
  </>;
}
