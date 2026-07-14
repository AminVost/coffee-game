/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Eye,
  MessageSquareWarning,
  Search,
  X
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { formatToman } from "@/lib/utils";

type PaymentItem = {
  id: string;
  publicId: string;
  internalReference: string;
  registrationPublicId: string;
  registrationTrackingCode: string | null;
  payerName: string;
  participantNames: string;
  participantMobiles: string;
  contactMobile: string;
  tournamentTitle: string;
  method: string;
  amount: number;
  status: string;
  cardLast4: string | null;
  trackingCode: string | null;
  paidOn: string | null;
  paidTime: string | null;
  submittedAt: string | null;
  rejectedReason?: string | null;
  correctionExpiresAt?: string | null;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const statusTitle: Record<string, string> = {
  PENDING: "در انتظار",
  NEEDS_CORRECTION: "نیازمند اصلاح",
  APPROVED: "تأییدشده",
  REJECTED: "رد نهایی",
  EXPIRED: "منقضی",
  CANCELLED: "لغوشده",
  REFUNDED: "بازگشت وجه"
};

const methodTitle: Record<string, string> = {
  card_to_card: "کارت‌به‌کارت",
  pos: "کارتخوان حضوری",
  cash: "نقدی حضوری",
  receipt: "انتقال بانکی قدیمی",
  online: "درگاه قدیمی"
};

const methodOptions = [
  { value: "all", label: "همه روش‌ها" },
  { value: "card_to_card", label: "کارت‌به‌کارت" },
  { value: "pos", label: "کارتخوان حضوری" },
  { value: "cash", label: "نقدی حضوری" }
];

const statusOptions = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "needs_review", label: "نیازمند بررسی" },
  { value: "NEEDS_CORRECTION", label: "نیازمند اصلاح" },
  { value: "onsite", label: "در انتظار پرداخت حضوری" },
  { value: "APPROVED", label: "تأییدشده" },
  { value: "REJECTED", label: "رد نهایی" },
  { value: "EXPIRED", label: "منقضی‌شده" }
];

function displayStatus(item: PaymentItem) {
  if (item.status === "PENDING" && item.method === "card_to_card" && item.submittedAt) {
    return "نیازمند بررسی";
  }
  if (item.status === "PENDING" && ["pos", "cash"].includes(item.method)) {
    return "در انتظار پرداخت حضوری";
  }
  return statusTitle[item.status] || item.status;
}

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR", includeTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" }
  ).format(date);
}

export function PaymentsManager() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("needs_review");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/payments", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.message || "دریافت پرداخت‌ها انجام نشد.");
      return;
    }
    setItems(payload.items || []);
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => ({
    review: items.filter((item) => (
      item.status === "PENDING"
      && item.method === "card_to_card"
      && item.submittedAt
    )).length,
    correction: items.filter((item) => item.status === "NEEDS_CORRECTION").length,
    onsite: items.filter((item) => (
      item.status === "PENDING"
      && ["pos", "cash"].includes(item.method)
    )).length,
    approved: items.filter((item) => item.status === "APPROVED").length
  }), [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery = !needle || [
        item.internalReference,
        item.registrationTrackingCode || "",
        item.payerName,
        item.participantNames,
        item.participantMobiles,
        item.contactMobile,
        item.tournamentTitle,
        item.trackingCode || "",
        item.cardLast4 || "",
        String(item.amount),
        item.status
      ].join(" ").toLowerCase().includes(needle);

      const matchesMethod = methodFilter === "all" || item.method === methodFilter;
      const matchesStatus = statusFilter === "all"
        || (
          statusFilter === "needs_review"
          && item.status === "PENDING"
          && item.method === "card_to_card"
          && Boolean(item.submittedAt)
        )
        || (
          statusFilter === "onsite"
          && item.status === "PENDING"
          && ["pos", "cash"].includes(item.method)
        )
        || item.status === statusFilter;

      return matchesQuery && matchesMethod && matchesStatus;
    });
  }, [items, methodFilter, query, statusFilter]);

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      setError("کپی خودکار انجام نشد؛ مقدار را دستی انتخاب کنید.");
    }
  }

  async function update(
    item: PaymentItem,
    action: "approve" | "request_correction" | "reject"
  ) {
    let reason = "";

    if (action === "approve") {
      const confirmed = window.confirm(
        `پرداخت ${formatToman(item.amount)} برای ${item.payerName} تأیید شود؟`
      );
      if (!confirmed) return;
    } else {
      const title = action === "request_correction"
        ? "دلیل نیاز به اصلاح را وارد کنید:"
        : "دلیل رد نهایی پرداخت را وارد کنید:";
      reason = window.prompt(title, item.rejectedReason || "")?.trim() || "";
      if (reason.length < 3) {
        setError("دلیل باید حداقل ۳ کاراکتر باشد.");
        return;
      }

      if (action === "reject") {
        const confirmed = window.confirm(
          "رد نهایی ظرفیت ثبت‌نام را آزاد می‌کند و کاربر دیگر امکان اصلاح این پرداخت را ندارد. ادامه می‌دهید؟"
        );
        if (!confirmed) return;
      }
    }

    setBusyId(item.id);
    setError("");

    const response = await fetch(`/api/admin/payments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(action === "approve" ? {} : { reason })
      })
    });
    const payload = await response.json();
    setBusyId("");

    if (!response.ok) {
      setError(payload.message || "تغییر وضعیت پرداخت انجام نشد.");
      return;
    }

    await load();
  }

  return (
    <div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary title="نیازمند بررسی" value={stats.review} />
        <Summary title="نیازمند اصلاح" value={stats.correction} />
        <Summary title="پرداخت حضوری" value={stats.onsite} />
        <Summary title="تأییدشده" value={stats.approved} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_220px]">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            size={17}
          />
          <Input
            className="pr-11"
            placeholder="نام، موبایل، کد پیگیری، مبلغ یا مسابقه..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <SelectField
          value={methodFilter}
          onValueChange={setMethodFilter}
          options={methodOptions}
        />
        <SelectField
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={statusOptions}
        />
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        ترتیب نمایش همیشه از جدیدترین پرداخت به قدیمی‌ترین است.
      </p>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-5 grid gap-4">
        {filtered.map((item) => {
          const canReview = item.status === "PENDING" || item.status === "NEEDS_CORRECTION";
          const needsCorrection = item.status === "NEEDS_CORRECTION";

          return (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.payerName}</strong>
                    <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold">
                      {displayStatus(item)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.tournamentTitle} · {methodTitle[item.method] || item.method}
                  </p>
                </div>
                <div className="text-left">
                  <strong className="block text-[var(--brand)]">{formatToman(item.amount)}</strong>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {formatDate(item.submittedAt || item.createdAt, true)}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr]">
                <div className="grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4 sm:grid-cols-2">
                  <Info title="شرکت‌کنندگان" value={item.participantNames} />
                  <Info title="موبایل‌ها" value={item.participantMobiles} dir="ltr" />
                  <Info title="موبایل ثبت‌کننده" value={item.contactMobile} dir="ltr" />
                  <Info title="شناسه داخلی" value={item.internalReference} dir="ltr" />
                  <Info
                    title="کد پیگیری ثبت‌نام"
                    value={item.registrationTrackingCode || "—"}
                    dir="ltr"
                  />
                  <Info title="روش پرداخت" value={methodTitle[item.method] || item.method} />
                </div>

                <div className="grid gap-3 rounded-2xl border border-[var(--line)] p-4 sm:grid-cols-2">
                  <Info title="نام واریزکننده" value={item.payerName} />
                  <Info title="۴ رقم آخر کارت" value={item.cardLast4 ? `**** ${item.cardLast4}` : "—"} dir="ltr" />
                  <Info title="کد پیگیری بانکی" value={item.trackingCode || "—"} dir="ltr" />
                  <Info title="تاریخ واریز" value={formatDate(item.paidOn)} />
                  <Info title="ساعت واریز" value={item.paidTime || "—"} dir="ltr" />
                  <Info
                    title="مهلت اصلاح"
                    value={formatDate(item.correctionExpiresAt, true)}
                  />
                </div>
              </div>

              {item.rejectedReason && (
                <Alert
                  tone={needsCorrection ? "warning" : "error"}
                  className="mx-5 mb-4"
                >
                  {item.rejectedReason}
                </Alert>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[var(--line)] p-5">
                {item.trackingCode && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyValue(item.trackingCode!, `bank-${item.id}`)}
                  >
                    <Clipboard size={15} />
                    {copied === `bank-${item.id}` ? "کپی شد" : "کپی کد بانکی"}
                  </Button>
                )}
                {item.registrationTrackingCode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyValue(
                      item.registrationTrackingCode!,
                      `registration-${item.id}`
                    )}
                  >
                    <Clipboard size={15} />
                    {copied === `registration-${item.id}`
                      ? "کپی شد"
                      : "کپی کد ثبت‌نام"}
                  </Button>
                )}
                {item.receiptUrl && (
                  <Button
                    href={item.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="sm"
                  >
                    <Eye size={15} />
                    مشاهده رسید
                  </Button>
                )}
                {canReview && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      loading={busyId === item.id}
                      onClick={() => update(item, "approve")}
                    >
                      <Check size={15} />
                      تأیید پرداخت
                    </Button>
                    {item.method === "card_to_card" && !needsCorrection && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => update(item, "request_correction")}
                      >
                        <MessageSquareWarning size={15} />
                        نیازمند اصلاح
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="dangerSoft"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => update(item, "reject")}
                    >
                      <X size={15} />
                      رد نهایی
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}

        {!loading && !filtered.length && (
          <Card className="p-10 text-center text-[var(--muted)]">
            پرداختی با این فیلتر پیدا نشد.
          </Card>
        )}
        {loading && (
          <Card className="p-10 text-center text-[var(--muted)]">
            در حال دریافت پرداخت‌ها...
          </Card>
        )}
      </div>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-[var(--muted)]">{title}</p>
      <strong className="mt-2 block text-2xl">{value.toLocaleString("fa-IR")}</strong>
    </Card>
  );
}

function Info({
  title,
  value,
  dir
}: {
  title: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <p className="text-[11px] text-[var(--muted)]">{title}</p>
      <strong className="mt-1 block text-sm" dir={dir}>{value}</strong>
    </div>
  );
}
