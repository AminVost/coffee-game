import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { findRegistrationTracking } from "@/lib/repositories/registration-tracking";
import { formatToman } from "@/lib/utils";

export const metadata: Metadata = {
  title: "پیگیری ثبت‌نام مسابقه",
  robots: { index: false, follow: false }
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function RegistrationTrackingPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const item = await findRegistrationTracking(token);

  if (!item) notFound();

  const success = ["CONFIRMED", "CHECKED_IN"].includes(item.registrationStatus);
  const warning = ["NEEDS_CORRECTION", "PENDING_PAYMENT"].includes(item.registrationStatus);
  const danger = ["REJECTED", "EXPIRED", "CANCELLED"].includes(item.registrationStatus);

  return (
    <div className="page-shell max-w-3xl">
      <div className="text-center">
        <p className="section-kicker">REGISTRATION TRACKING</p>
        <h1 className="section-title mt-2">پیگیری ثبت‌نام مسابقه</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          این صفحه آخرین وضعیت ثبت‌نام و پرداخت را بدون نیاز به ورود نمایش می‌دهد.
        </p>
      </div>

      <Card className="mt-7 overflow-hidden">
        <div className="border-b border-[var(--line)] bg-[var(--surface-2)] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[var(--muted)]">مسابقه</p>
              <h2 className="mt-1 text-xl font-black">{item.tournamentTitle}</h2>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left">
              <p className="text-[11px] text-[var(--muted)]">کد پیگیری</p>
              <strong className="mt-1 block" dir="ltr">{item.trackingCode}</strong>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-7">
          <Alert tone={success ? "success" : danger ? "error" : warning ? "warning" : "info"}>
            <strong className="block">{item.registrationStatusTitle}</strong>
            <span className="mt-1 block font-normal">{item.nextAction}</span>
          </Alert>

          {item.rejectedReason && (
            <Alert tone="error">
              <strong className="block">دلیل اعلام‌شده توسط مدیر</strong>
              <span className="mt-1 block font-normal">{item.rejectedReason}</span>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={<CreditCard size={17} />} title="وضعیت پرداخت" value={item.paymentStatusTitle} />
            <Info icon={<ShieldCheck size={17} />} title="وضعیت ثبت‌نام" value={item.registrationStatusTitle} />
            <Info icon={<CalendarDays size={17} />} title="زمان مسابقه" value={formatDateTime(item.startsAt)} />
            <Info icon={<MapPin size={17} />} title="محل برگزاری" value={item.venue} />
            <Info icon={<Phone size={17} />} title="شماره تماس ثبت‌کننده" value={item.maskedMobile} dir="ltr" />
            <Info icon={<CreditCard size={17} />} title="کارت واریزکننده" value={item.maskedCard} dir="ltr" />
            <Info icon={<CreditCard size={17} />} title="روش پرداخت" value={item.paymentMethodTitle} />
            <Info icon={<CreditCard size={17} />} title="مبلغ" value={formatToman(item.amount)} />
          </div>

          {item.correctionExpiresAt && item.registrationStatus === "NEEDS_CORRECTION" && (
            <Alert tone="warning">
              مهلت اصلاح اطلاعات: {formatDateTime(item.correctionExpiresAt)}
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-2">
              <Clock3 size={15} />
              آخرین به‌روزرسانی: {formatDateTime(item.updatedAt)}
            </span>
            <Button href={`/track/${token}`} variant="ghost" size="sm">
              <RefreshCw size={15} />
              به‌روزرسانی وضعیت
            </Button>
          </div>

          {item.registrationStatus === "NEEDS_CORRECTION" && (
            <div className="flex flex-wrap gap-2">
              <Button href="/login">ورود با همان شماره موبایل</Button>
              <Button href="/account/payments" variant="secondary">مشاهده پرداخت‌های من</Button>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
              <CheckCircle2 size={18} />
              ثبت‌نام شما در فهرست نهایی شرکت‌کنندگان قرار دارد.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Info({
  icon,
  title,
  value,
  dir
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/12 text-[var(--brand)]">
        {icon}
      </span>
      <div>
        <p className="text-[11px] text-[var(--muted)]">{title}</p>
        <strong className="mt-1 block text-sm" dir={dir}>{value}</strong>
      </div>
    </div>
  );
}
