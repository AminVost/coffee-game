import { DrawManager } from "@/components/admin/draw-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export const dynamic = "force-dynamic";

export default async function TournamentDrawPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("draws.manage");
  const { id } = await params;
  return <div>
    <p className="section-kicker">DRAW MANAGEMENT</p>
    <h1 className="section-title mt-2">مدیریت قرعه و Seed بندی</h1>
    <DrawManager tournamentId={id}/>
  </div>;
}
