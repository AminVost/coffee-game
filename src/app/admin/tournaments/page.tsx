import { Plus } from "lucide-react";
import { TournamentsManager } from "@/components/admin/tournaments-manager";
import { Button } from "@/components/ui/button";
import { listTournaments } from "@/lib/repositories/tournaments";

export const dynamic = "force-dynamic";

export default async function AdminTournaments() {
  const items = await listTournaments();
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">TOURNAMENT MANAGEMENT</p><h1 className="section-title mt-2">مدیریت مسابقات</h1></div><Button href="/admin/tournaments/new"><Plus size={17}/>ساخت مسابقه</Button></div><TournamentsManager initialItems={items}/></div>;
}
