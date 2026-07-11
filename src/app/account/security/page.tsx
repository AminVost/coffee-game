import { SessionsManager } from "@/components/account/sessions-manager";

export default function SecurityPage() {
  return <div>
    <p className="section-kicker">ACCOUNT SECURITY</p>
    <h1 className="section-title mt-2">نشست‌های فعال</h1>
    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">دستگاه‌هایی که با حساب شما وارد شده‌اند را مشاهده و نشست‌های ناشناس را قطع کنید.</p>
    <SessionsManager/>
  </div>;
}
