import type { Metadata } from "next";
import { RankingsSection } from "@/components/rankings/rankings-section";
import { getRankingRows, listRankingGames } from "@/lib/repositories/rankings";

export const metadata: Metadata = { title: "رنکینگ بازیکنان" };
export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const games = await listRankingGames();
  const sections = await Promise.all(games.map(async (game) => ({
    ...game,
    rows: await getRankingRows(game.slug, "all_time")
  })));

  return <div className="page-shell">
    <p className="section-kicker">PLAYER RANKING</p>
    <h1 className="section-title mt-2">رنکینگ بازیکنان</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
      رنکینگ هر بازی و هر بازه مستقیماً از نتایج ثبت‌شده در دیتابیس محاسبه و نمایش داده می‌شود.
    </p>
    {sections.map((game) => (
      <RankingsSection key={game.slug} game={game.slug} title={game.title} initialRows={game.rows} />
    ))}
    {!sections.length && <div className="mt-8 rounded-[1.75rem] border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
      هنوز رنکینگ فعالی برای هیچ بازی ثبت نشده است.
    </div>}
  </div>;
}
