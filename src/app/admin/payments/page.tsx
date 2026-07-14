import { PaymentsManager } from "@/components/admin/payments-manager";

export default function Payments() {
  return <div>
    <p className="section-kicker">PAYMENT INBOX</p>
    <h1 className="section-title mt-2">صندوق پرداخت‌ها</h1>
    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">تطبیق انتقال‌های بانکی و ثبت پرداخت‌های کارتخوان یا نقدی، همگی در یک صفحه انجام می‌شود.</p>
    <PaymentsManager />
  </div>;
}
