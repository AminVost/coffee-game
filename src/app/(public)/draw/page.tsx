import { Shuffle } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

type DrawRow = RowDataPacket & {
  tournament_title: string;
  participant_name: string;
  seed: number | null;
};

export const dynamic = "force-dynamic";

export default async function Draw() {
  const rows = await queryRows<DrawRow[]>(`
    SELECT
      t.title AS tournament_title,
      COALESCE(team.title,player.name,'شرکت‌کننده') AS participant_name,
      re.seed
    FROM tournaments t
    JOIN registration_entries re ON re.registration_id IN (
      SELECT r.id FROM registrations r
      WHERE r.tournament_id=t.id AND r.status IN ('CONFIRMED','CHECKED_IN') AND r.deleted_at IS NULL
    )
    LEFT JOIN teams team ON team.id=re.team_id
    LEFT JOIN players player ON player.id=re.player_id
    WHERE t.deleted_at IS NULL
      AND t.id=(
        SELECT t2.id FROM tournaments t2
        WHERE t2.deleted_at IS NULL AND t2.status IN ('DRAW_READY','RUNNING')
        ORDER BY FIELD(t2.status,'DRAW_READY','RUNNING'),t2.starts_at DESC,t2.id DESC
        LIMIT 1
      )
    ORDER BY COALESCE(re.seed,999999),re.id
  `);

  const title = rows[0]?.tournament_title;
  return (
    <div className="page-shell">
      <p className="section-kicker">LIVE DRAW</p>
      <h1 className="section-title mt-2">قرعه‌کشی زنده</h1>
      {title && <p className="mt-3 text-sm text-[var(--muted)]">{title}</p>}
      <Card className="mt-8 overflow-hidden p-6 sm:p-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((item, index) => (
            <div key={`${item.participant_name}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-5 text-center font-black">
              <Shuffle className="mx-auto mb-3 text-[var(--brand)]" />
              {item.participant_name}
              <span className="mt-2 block text-xs text-[var(--muted)]">Seed {item.seed || index + 1}</span>
            </div>
          ))}
        </div>
        {!rows.length && <p className="text-center text-[var(--muted)]">قرعه فعال یا شرکت‌کننده قطعی وجود ندارد.</p>}
      </Card>
    </div>
  );
}
