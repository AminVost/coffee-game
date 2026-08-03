import { TournamentParticipantsManager } from "@/components/admin/tournament-participants-manager";
import { requireAdminPage } from "@/lib/page-authorization";

export default async function TournamentParticipantsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("tournaments.manage");
  const { id } = await params;

  return (
    <div>
      <p className="section-kicker">FINAL PARTICIPANTS</p>
      <h1 className="section-title mt-2">نهایی‌سازی شرکت‌کنندگان</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        در این صفحه فقط ثبت‌نام‌های قطعی بررسی می‌شوند. بعد از نهایی‌سازی، ثبت‌نام بسته می‌شود و فهرست آماده قرعه خواهد بود.
      </p>
      <TournamentParticipantsManager tournamentId={id} />
    </div>
  );
}
