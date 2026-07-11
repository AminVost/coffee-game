import type { RowDataPacket } from "mysql2";
import type { RankingRow } from "@/types";
import { queryRows } from "@/lib/db";

export const rankingPeriods = ["all_time", "monthly", "seasonal", "yearly"] as const;
export type RankingPeriod = typeof rankingPeriods[number];

type RankingDbRow = RowDataPacket & {
  player_id: number;
  name: string;
  nickname: string | null;
  points: string | number;
  wins: number;
  played: number;
  previous_rank: number | null;
};

export function isRankingPeriod(value: string): value is RankingPeriod {
  return rankingPeriods.includes(value as RankingPeriod);
}

export async function getRankingRows(gameSlug: string, period: RankingPeriod): Promise<RankingRow[]> {
  const rows = await queryRows<RankingDbRow[]>(`
    SELECT
      re.player_id,
      COALESCE(NULLIF(p.nickname,''), u.name, p.guest_name, CONCAT('بازیکن ', p.id)) AS name,
      p.nickname,
      re.points,
      re.wins,
      re.played,
      CAST(JSON_UNQUOTE(JSON_EXTRACT(re.metadata, '$.previousRank')) AS UNSIGNED) AS previous_rank
    FROM ranking_boards rb
    JOIN games g ON g.id=rb.game_id
    JOIN ranking_entries re ON re.board_id=rb.id
    JOIN players p ON p.id=re.player_id
    LEFT JOIN users u ON u.id=p.user_id
    WHERE g.slug=?
      AND rb.period_type=?
      AND rb.is_active=1
    ORDER BY (re.points + re.adjustment) DESC, re.wins DESC, re.played ASC, re.player_id ASC
    LIMIT 100
  `, [gameSlug, period]);

  return rows.map((row, index) => {
    const rank = index + 1;
    const previousRank = row.previous_rank || rank;
    const name = row.name || `بازیکن ${row.player_id}`;

    return {
      rank,
      name,
      avatar: name.trim().charAt(0) || "ب",
      played: Number(row.played || 0),
      wins: Number(row.wins || 0),
      points: Number(row.points || 0),
      trend: previousRank - rank
    };
  });
}
