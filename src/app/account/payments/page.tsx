import { PaymentsList } from "@/components/account/payments-list";

export default function Payments() {
  return <div>
    <p className="section-kicker">PAYMENTS</p>
    <h1 className="section-title mt-2">پرداخت‌های من</h1>
    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">وضعیت تأیید پرداخت و اطلاعات انتقال بانکی خود را از این بخش پیگیری کنید.</p>
    <PaymentsList />
  </div>;
}
