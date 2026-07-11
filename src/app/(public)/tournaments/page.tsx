import type { Metadata } from "next";
import { TournamentFilters } from "@/components/tournament-filters";
import { listTournaments } from "@/lib/repositories/tournaments";

export const metadata: Metadata = { title: "مسابقات" };
export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const items = await listTournaments();
  return <div className="page-shell">
    <p className="section-kicker">TOURNAMENTS</p>
    <h1 className="section-title mt-2">مسابقات پیش‌رو و جاری</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">برای مشاهده قوانین، ظرفیت، جوایز و ثبت‌نام وارد صفحه هر مسابقه شوید.</p>
    <TournamentFilters items={items}/>
  </div>;
}
