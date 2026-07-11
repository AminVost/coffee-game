import { PaymentsManager } from "@/components/admin/payments-manager";

export default function Payments() {
  return <div>
    <p className="section-kicker">PAYMENTS</p>
    <h1 className="section-title mt-2">پرداخت‌ها و فیش‌ها</h1>
    <PaymentsManager/>
  </div>;
}
