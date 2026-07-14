import { Trophy } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

type ChampionRow = RowDataPacket & {
  tournament_title: string;
  winner_name: string;
  completed_at: Date;
};

export const dynamic = "force-dynamic";

export default async function Champions() {
  const champions = await queryRows<ChampionRow[]>(`
    SELECT
      t.title AS tournament_title,
      COALESCE(team.title,player.name,'برنده ثبت‌نشده') AS winner_name,
      m.completed_at
    FROM tournament_matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN tournament_rounds tr ON tr.id=m.round_id
    JOIN match_participants mp ON mp.match_id=m.id AND mp.slot=m.winner_slot
    LEFT JOIN teams team ON team.id=mp.team_id
    LEFT JOIN players player ON player.id=mp.player_id
    WHERE m.status='COMPLETED'
      AND m.winner_slot IS NOT NULL
      AND (tr.stage='FINAL' OR tr.title LIKE '%فینال%')
      AND t.deleted_at IS NULL
    ORDER BY m.completed_at DESC,m.id DESC
    LIMIT 30
  `);

  return (
    <div className="page-shell">
      <p className="section-kicker">HALL OF FAME</p>
      <h1 className="section-title mt-2">قهرمانان Coffee Game</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {champions.map((item, index) => (
          <Card key={`${item.tournament_title}-${item.completed_at}-${index}`} className="p-7 text-center">
            <Trophy className="mx-auto text-amber-500" size={42} />
            <h2 className="mt-5 text-xl font-black">{item.winner_name}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.tournament_title}</p>
            <time className="mt-2 block text-xs text-[var(--muted)]">
              {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(item.completed_at))}
            </time>
          </Card>
        ))}
      </div>
      {!champions.length && <Card className="mt-8 p-10 text-center text-[var(--muted)]">هنوز قهرمان نهایی ثبت نشده است.</Card>}
    </div>
  );
}
