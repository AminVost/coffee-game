import { TournamentScheduleManager } from "@/components/admin/tournament-schedule-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export const dynamic = "force-dynamic";

export default async function TournamentSchedulePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("matches.manage");
  const { id } = await params;

  return (
    <div>
      <p className="section-kicker">MATCH SCHEDULING</p>
      <h1 className="section-title mt-2">زمان‌بندی بازی‌ها</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        ابتدا برنامه پیشنهادی را ببین و بعد همان برنامه را ثبت کن. تداخل بازیکن، میز یا دستگاه و داور به‌صورت خودکار کنترل می‌شود.
      </p>
      <TournamentScheduleManager tournamentId={id} />
    </div>
  );
}
