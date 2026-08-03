import { TournamentCompletionManager } from "@/components/admin/tournament-completion-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export const dynamic = "force-dynamic";

export default async function TournamentCompletionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("tournaments.manage");
  const { id } = await params;

  return (
    <div>
      <p className="section-kicker">TOURNAMENT COMPLETION</p>
      <h1 className="section-title mt-2">پایان مسابقه و تعیین قهرمان</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        این صفحه بازی‌های باقی‌مانده، اعتراض‌های باز و نتیجه نهایی را بررسی می‌کند. مسابقه فقط وقتی پایان می‌یابد که قهرمان بدون ابهام مشخص باشد.
      </p>
      <TournamentCompletionManager tournamentId={id} />
    </div>
  );
}
