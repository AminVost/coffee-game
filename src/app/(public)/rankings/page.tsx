import type { Metadata } from "next";
import { RankingsSection } from "@/components/rankings/rankings-section";
import { backgammonRankings, fcRankings } from "@/data/mock-data";
import { env } from "@/lib/env";
import { getRankingRows } from "@/lib/repositories/rankings";

export const metadata: Metadata = { title: "رنکینگ بازیکنان" };

export default async function RankingsPage() {
  const [fcRows, backgammonRows] = env.dataMode === "mysql"
    ? await Promise.all([
        getRankingRows("fc26", "all_time"),
        getRankingRows("backgammon", "all_time")
      ])
    : [fcRankings, backgammonRankings];

  return <div className="page-shell">
    <p className="section-kicker">PLAYER RANKING</p>
    <h1 className="section-title mt-2">رنکینگ بازیکنان</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">امتیازهای FC 26 و تخته‌نرد کاملاً مستقل محاسبه می‌شوند. بازه ماهانه، فصلی، سالانه و تمام دوران مستقیماً از داده‌های ثبت‌شده خوانده می‌شود.</p>
    <RankingsSection game="fc26" title="FC 26" initialRows={fcRows}/>
    <RankingsSection game="backgammon" title="تخته‌نرد" initialRows={backgammonRows}/>
  </div>;
}
