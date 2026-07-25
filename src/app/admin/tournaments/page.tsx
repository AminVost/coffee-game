import { Plus } from "lucide-react";
import { TournamentsManager } from "@/components/admin/tournaments-manager";
import { Button } from "@/components/ui/button";
import { getSession, hasPermission } from "@/lib/auth";
import { listTournaments } from "@/lib/repositories/tournaments";
import { requireAdminPage } from "@/lib/page-authorization";

export const dynamic = "force-dynamic";

export default async function AdminTournaments() {
  await requireAdminPage("tournaments.view");
  const [items, user] = await Promise.all([listTournaments(true), getSession()]);
  const permissions = {
    canManage: hasPermission(user, "tournaments.manage"),
    canDraw: hasPermission(user, "draws.manage"),
    canSchedule: hasPermission(user, "matches.manage")
  };
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">TOURNAMENT MANAGEMENT</p><h1 className="section-title mt-2">مدیریت مسابقات</h1></div>{permissions.canManage && <Button href="/admin/tournaments/new"><Plus size={17}/>ساخت مسابقه</Button>}</div><TournamentsManager initialItems={items} permissions={permissions}/></div>;
}
