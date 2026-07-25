import { PlayersManager } from "@/components/admin/players-manager";
import { hasPermission } from "@/lib/auth";
import { requireAdminPage } from "@/lib/page-authorization";

export default async function PlayersPage() {
  const user=await requireAdminPage("players.view");
  return <div>
    <p className="section-kicker">PLAYERS</p>
    <h1 className="section-title mt-2">بازیکنان سیستم</h1>
    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">فهرست کامل بازیکنان عضو و مهمان، اطلاعات تماس، سابقه ثبت‌نام، تیم‌ها و امتیازهای آن‌ها.</p>
    <PlayersManager canManage={hasPermission(user,"users.manage")}/>
  </div>;
}
