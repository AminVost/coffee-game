/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, Eye, Link2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label, FieldHint } from "@/components/ui/label";
import { formatToman } from "@/lib/utils";

type PaymentItem = {
  id: string;
  publicId: string;
  tournamentTitle: string;
  amount: number;
  method: string;
  status: string;
  payerName: string | null;
  cardLast4: string | null;
  trackingCode: string | null;
  paidOn: string | null;
  paidTime: string | null;
  submittedAt: string | null;
  rejectedReason: string | null;
  correctionExpiresAt: string | null;
  receiptUrl: string | null;
  registrationTrackingCode: string | null;
  trackingPath: string | null;
};

type EditState = {
  payerName: string;
  cardLast4: string;
  trackingCode: string;
  paidOn: string;
  paidTime: string;
  receipt: File | null;
};

const statusTitle: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  NEEDS_CORRECTION: "نیازمند اصلاح",
  REJECTED: "رد نهایی",
  EXPIRED: "منقضی",
  CANCELLED: "لغوشده",
  REFUNDED: "بازگشت وجه"
};

const methodTitle: Record<string, string> = {
  card_to_card: "کارت‌به‌کارت / انتقال بانکی",
  pos: "کارتخوان حضوری",
  cash: "پرداخت نقدی حضوری",
  receipt: "انتقال بانکی قدیمی",
  online: "درگاه قدیمی"
};

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function PaymentsList() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [edit, setEdit] = useState<EditState>({
    payerName: "",
    cardLast4: "",
    trackingCode: "",
    paidOn: today(),
    paidTime: "",
    receipt: null
  });

  async function load() {
    const response = await fetch("/api/account/payments", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.message || "دریافت پرداخت‌ها انجام نشد.");
    setItems(payload.items || []);
  }

  useEffect(() => { void load(); }, []);

  function startEdit(item: PaymentItem) {
    setEditingId(item.id);
    setError("");
    setSuccess("");
    setEdit({
      payerName: item.payerName || "",
      cardLast4: item.cardLast4 || "",
      trackingCode: item.trackingCode || "",
      paidOn: item.paidOn || today(),
      paidTime: item.paidTime || "",
      receipt: null
    });
  }

  async function save(item: PaymentItem) {
    if (edit.payerName.trim().length < 2) return setError("نام واریزکننده را وارد کنید.");
    if (!/^\d{4}$/.test(edit.cardLast4)) return setError("۴ رقم آخر کارت را صحیح وارد کنید.");
    if (edit.trackingCode.trim().length < 4) return setError("کد پیگیری را وارد کنید.");
    if (!edit.paidOn) return setError("تاریخ واریز را وارد کنید.");

    setBusyId(item.id);
    setError("");
    setSuccess("");

    const response = await fetch(`/api/account/payments/${item.publicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerName: edit.payerName,
        cardLast4: edit.cardLast4,
        trackingCode: edit.trackingCode,
        paidOn: edit.paidOn,
        paidTime: edit.paidTime || null
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setBusyId("");
      return setError(payload.message || "ثبت اطلاعات پرداخت انجام نشد.");
    }

    if (edit.receipt) {
      const form = new FormData();
      form.set("paymentId", item.publicId);
      form.set("file", edit.receipt);
      const uploadResponse = await fetch("/api/payments/receipts", { method: "POST", body: form });
      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setBusyId("");
        return setError(uploadPayload.message || "اطلاعات ثبت شد اما بارگذاری تصویر رسید انجام نشد.");
      }
    }

    setBusyId("");
    setEditingId("");
    setSuccess("اطلاعات انتقال برای بررسی مجدد ارسال شد.");
    await load();
  }

  return <div>
    {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    {success && <Alert tone="success" className="mt-4">{success}</Alert>}

    <div className="mt-7 grid gap-4">
      {items.map((item) => {
        const canEdit = item.method === "card_to_card" && ["PENDING", "NEEDS_CORRECTION"].includes(item.status);
        const isEditing = editingId === item.id;
        const displayStatus = item.status === "PENDING" && ["pos", "cash"].includes(item.method)
          ? "در انتظار پرداخت حضوری"
          : statusTitle[item.status] || item.status;

        return <Card key={item.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><strong>{item.tournamentTitle}</strong><p className="mt-1 text-xs text-[var(--muted)]">{methodTitle[item.method] || item.method}</p></div>
            <div className="text-left"><strong className="block text-[var(--brand)]">{formatToman(item.amount)}</strong><span className="mt-1 block text-xs font-bold text-[var(--muted)]">{displayStatus}</span></div>
          </div>

          {item.method === "card_to_card" && !isEditing && <div className="mt-4 grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info title="واریزکننده" value={item.payerName || "ثبت نشده"} />
            <Info title="کد پیگیری" value={item.trackingCode || "ثبت نشده"} dir="ltr" />
            <Info title="۴ رقم آخر کارت" value={item.cardLast4 ? `**** ${item.cardLast4}` : "ثبت نشده"} dir="ltr" />
            <Info title="تاریخ و ساعت" value={`${item.paidOn || "—"}${item.paidTime ? ` - ${item.paidTime}` : ""}`} dir="ltr" />
          </div>}

          {item.rejectedReason && <Alert tone={item.status === "NEEDS_CORRECTION" ? "warning" : "error"} className="mt-4">
            {item.rejectedReason}
            {item.status === "NEEDS_CORRECTION" && item.correctionExpiresAt && <span className="mt-1 block text-xs font-normal">
              مهلت اصلاح: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.correctionExpiresAt))}
            </span>}
          </Alert>}
          {item.status === "APPROVED" && <Alert tone="success" className="mt-4"><span className="inline-flex items-center gap-2"><CheckCircle2 size={16} />ثبت‌نام شما نهایی شده است.</span></Alert>}

          {isEditing && <div className="mt-4 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <Label>نام واریزکننده<Input value={edit.payerName} onChange={(event) => setEdit((state) => ({ ...state, payerName: event.target.value }))} required /></Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label>۴ رقم آخر کارت<Input dir="ltr" inputMode="numeric" value={edit.cardLast4} onChange={(event) => setEdit((state) => ({ ...state, cardLast4: event.target.value.replace(/\D/g, "").slice(0, 4) }))} required /></Label>
              <Label>کد پیگیری<Input dir="ltr" value={edit.trackingCode} onChange={(event) => setEdit((state) => ({ ...state, trackingCode: event.target.value.replace(/\s/g, "").slice(0, 64) }))} required /></Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label>تاریخ واریز<Input type="date" value={edit.paidOn} onChange={(event) => setEdit((state) => ({ ...state, paidOn: event.target.value }))} required /></Label>
              <Label>ساعت واریز <span className="font-normal text-[var(--muted)]">(اختیاری)</span><Input type="time" value={edit.paidTime} onChange={(event) => setEdit((state) => ({ ...state, paidTime: event.target.value }))} /></Label>
            </div>
            <Label>تصویر رسید <span className="font-normal text-[var(--muted)]">(اختیاری)</span><Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setEdit((state) => ({ ...state, receipt: event.target.files?.[0] || null }))} /><FieldHint>ارسال تصویر اجباری نیست.</FieldHint></Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" loading={busyId === item.id} loadingText="در حال ارسال" onClick={() => save(item)}>ارسال برای بررسی</Button>
              <Button type="button" variant="secondary" disabled={busyId === item.id} onClick={() => setEditingId("")}>انصراف</Button>
            </div>
          </div>}

          {!isEditing && <div className="mt-4 flex flex-wrap gap-2">
            {item.trackingPath && <Button href={item.trackingPath} variant="soft" size="sm"><Link2 size={15} />پیگیری ثبت‌نام</Button>}
            {item.receiptUrl && <Button href={item.receiptUrl} target="_blank" rel="noreferrer" variant="secondary" size="sm"><Eye size={15} />مشاهده رسید</Button>}
            {canEdit && <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(item)}><Edit3 size={15} />{item.status === "NEEDS_CORRECTION" ? "اصلاح اطلاعات" : "ویرایش اطلاعات واریز"}</Button>}
            {canEdit && !item.receiptUrl && <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(item)}><Upload size={15} />افزودن رسید اختیاری</Button>}
          </div>}
        </Card>;
      })}

      {!loading && !items.length && <Card className="p-10 text-center text-[var(--muted)]">پرداختی وجود ندارد.</Card>}
      {loading && <Card className="p-10 text-center text-[var(--muted)]">در حال دریافت...</Card>}
    </div>
  </div>;
}

function Info({ title, value, dir }: { title: string; value: string; dir?: "ltr" | "rtl" }) {
  return <div><p className="text-[11px] text-[var(--muted)]">{title}</p><strong className="mt-1 block text-sm" dir={dir}>{value}</strong></div>;
}
