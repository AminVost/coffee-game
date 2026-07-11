import { PlayersManager } from "@/components/admin/players-manager";

export default function PlayersPage() {
  return <div>
    <p className="section-kicker">PLAYERS</p>
    <h1 className="section-title mt-2">بازیکنان سیستم</h1>
    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
      فهرست کامل بازیکنان عضو و مهمان، اطلاعات تماس، سابقه ثبت‌نام، تیم‌ها و امتیازهای آن‌ها.
    </p>
    <PlayersManager/>
  </div>;
}
