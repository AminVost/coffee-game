import { PaymentsList } from "@/components/account/payments-list";

export default function Payments() {
  return <div>
    <p className="section-kicker">PAYMENTS</p>
    <h1 className="section-title mt-2">پرداخت‌های من</h1>
    <PaymentsList/>
  </div>;
}
