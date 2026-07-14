import type { RowDataPacket } from "mysql2";
import type { RankingRow } from "@/types";
import { queryRows } from "@/lib/db";

export const rankingPeriods = ["all_time", "monthly", "seasonal", "yearly"] as const;
export type RankingPeriod = (typeof rankingPeriods)[number];

type RankingDbRow = RowDataPacket & {
  player_id: number;
  name: string;
  points: string | number;
  wins: number;
  played: number;
  previous_rank: number | null;
};

type RankingGameRow = RowDataPacket & {
  slug: string;
  title: string;
};

export function isRankingPeriod(value: string): value is RankingPeriod {
  return rankingPeriods.includes(value as RankingPeriod);
}

export async function listRankingGames() {
  const rows = await queryRows<RankingGameRow[]>(`
    SELECT DISTINCT g.slug,g.title
    FROM games g
    JOIN ranking_boards rb ON rb.game_id=g.id AND rb.is_active=1
    WHERE g.is_active=1
    ORDER BY g.title ASC
  `);
  return rows.map((row) => ({ slug: row.slug, title: row.title }));
}

export async function isActiveRankingGame(gameSlug: string) {
  const rows = await queryRows<(RowDataPacket & { id: number })[]>(`
    SELECT g.id
    FROM games g
    JOIN ranking_boards rb ON rb.game_id=g.id AND rb.is_active=1
    WHERE g.slug=? AND g.is_active=1
    LIMIT 1
  `, [gameSlug]);
  return Boolean(rows[0]);
}

export async function getRankingRows(
  gameSlug: string,
  period: RankingPeriod
): Promise<RankingRow[]> {
  const rows = await queryRows<RankingDbRow[]>(`
    SELECT
      re.player_id,
      COALESCE(
        NULLIF(u.nickname, ''),
        NULLIF(p.name, ''),
        NULLIF(u.name, ''),
        CONCAT('بازیکن ', p.id)
      ) AS name,
      re.points,
      re.wins,
      re.played,
      CAST(
        JSON_UNQUOTE(JSON_EXTRACT(re.metadata, '$.previousRank'))
        AS UNSIGNED
      ) AS previous_rank
    FROM ranking_boards rb
    JOIN games g ON g.id=rb.game_id
    JOIN ranking_entries re ON re.board_id=rb.id
    JOIN players p ON p.id=re.player_id
    LEFT JOIN users u ON u.id=p.user_id
    WHERE g.slug=?
      AND rb.period_type=?
      AND rb.is_active=1
    ORDER BY
      (re.points + re.adjustment) DESC,
      re.wins DESC,
      re.played ASC,
      re.player_id ASC
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
