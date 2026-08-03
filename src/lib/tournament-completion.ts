import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";

export type CompletionParticipant = {
  key: string;
  playerId: number | null;
  teamId: number | null;
  name: string;
  seed: number | null;
};

export type CompletionStanding = {
  rank: number;
  participant: CompletionParticipant;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  points: number;
};

export type TournamentCompletionSnapshot = {
  tournamentId: number;
  title: string;
  status: string;
  format: string;
  category: "knockout" | "league" | "group" | "swiss" | "double";
  totalMatches: number;
  completedMatches: number;
  remainingMatches: number;
  openDisputes: number;
  unresolvedCancelledMatches: number;
  progressPercent: number;
  champion: CompletionParticipant | null;
  runnerUp: CompletionParticipant | null;
  thirdPlace: CompletionParticipant | null;
  standings: CompletionStanding[];
  blockers: string[];
  warnings: string[];
  readyToFinalize: boolean;
  completed: boolean;
};

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  status: string;
  format: string;
  scoring_settings: unknown;
};

type MatchSummaryRow = RowDataPacket & {
  total_matches: number;
  completed_matches: number;
  remaining_matches: number;
  unresolved_cancelled: number;
};

type MatchParticipantRow = RowDataPacket & {
  match_id: number;
  pair_key: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner_slot: number | null;
  slot: number;
  player_id: number | null;
  team_id: number | null;
  seed: number | null;
  participant_name: string | null;
};

type StandingMatchRow = RowDataPacket & {
  match_id: number;
  home_score: number;
  away_score: number;
  home_player_id: number | null;
  home_team_id: number | null;
  home_seed: number | null;
  home_name: string | null;
  away_player_id: number | null;
  away_team_id: number | null;
  away_seed: number | null;
  away_name: string | null;
};

function parseObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function safeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function categoryOf(format: string): TournamentCompletionSnapshot["category"] {
  const normalized = format.toLowerCase();
  if (normalized.includes("گروه") || normalized.includes("group")) return "group";
  if (normalized.includes("سوئیس") || normalized.includes("swiss")) return "swiss";
  if (normalized.includes("دوحذفی") || normalized.includes("double elimination")) return "double";
  if (normalized.includes("لیگ") || normalized.includes("round robin")) return "league";
  return "knockout";
}

function participantKey(playerId: number | null, teamId: number | null) {
  return playerId ? `p:${playerId}` : `t:${teamId}`;
}

function participantFromRow(row: {
  player_id: number | null;
  team_id: number | null;
  seed: number | null;
  participant_name: string | null;
}): CompletionParticipant {
  const playerId = row.player_id ? Number(row.player_id) : null;
  const teamId = row.team_id ? Number(row.team_id) : null;
  return {
    key: participantKey(playerId, teamId),
    playerId,
    teamId,
    name: row.participant_name || "شرکت‌کننده نامشخص",
    seed: row.seed === null ? null : Number(row.seed)
  };
}

function participantFromStanding(
  playerId: number | null,
  teamId: number | null,
  seed: number | null,
  name: string | null
): CompletionParticipant | null {
  if (!playerId && !teamId) return null;
  return {
    key: participantKey(playerId, teamId),
    playerId: playerId ? Number(playerId) : null,
    teamId: teamId ? Number(teamId) : null,
    seed: seed === null ? null : Number(seed),
    name: name || "شرکت‌کننده نامشخص"
  };
}

async function loadRoundResult(
  connection: PoolConnection,
  tournamentId: number,
  stages: string[]
) {
  const placeholders = stages.map(() => "?").join(",");
  const [roundRows] = await connection.query<Array<RowDataPacket & { id: number }>>(`
    SELECT round_row.id
    FROM tournament_rounds round_row
    WHERE round_row.tournament_id=? AND round_row.stage IN (${placeholders})
    ORDER BY round_row.round_number DESC,
      FIELD(round_row.stage,'double_reset','double_final','knockout','third_place') ASC,
      round_row.id DESC
    LIMIT 1
  `, [tournamentId, ...stages]);
  const roundId = Number(roundRows[0]?.id || 0);
  if (!roundId) return { winner: null, loser: null, tied: false, pairCount: 0 };

  const [rows] = await connection.query<MatchParticipantRow[]>(`
    SELECT
      match_row.id AS match_id,match_row.pair_key,match_row.status,
      match_row.home_score,match_row.away_score,match_row.winner_slot,
      participant.slot,participant.player_id,participant.team_id,participant.seed,
      COALESCE(team.title,player.name) AS participant_name
    FROM tournament_matches match_row
    JOIN match_participants participant ON participant.match_id=match_row.id
    LEFT JOIN teams team ON team.id=participant.team_id
    LEFT JOIN players player ON player.id=participant.player_id
    WHERE match_row.round_id=? AND match_row.status='COMPLETED'
    ORDER BY match_row.match_number,participant.slot
  `, [roundId]);

  const pairs = new Map<string, Map<string, { participant: CompletionParticipant; score: number }>>();
  for (const row of rows) {
    const pairKey = row.pair_key || `match:${row.match_id}`;
    const participants = pairs.get(pairKey) || new Map<string, { participant: CompletionParticipant; score: number }>();
    const participant = participantFromRow(row);
    const scored = Number(row.slot) === 1 ? Number(row.home_score || 0) : Number(row.away_score || 0);
    const current = participants.get(participant.key) || { participant, score: 0 };
    current.score += scored;
    participants.set(participant.key, current);
    pairs.set(pairKey, participants);
  }

  if (pairs.size !== 1) {
    return { winner: null, loser: null, tied: false, pairCount: pairs.size };
  }
  const entries = [...pairs.values()][0]
    ? [...[...pairs.values()][0].values()].sort((left, right) => right.score - left.score)
    : [];
  if (entries.length === 1) {
    return { winner: entries[0].participant, loser: null, tied: false, pairCount: 1 };
  }
  if (entries.length < 2) return { winner: null, loser: null, tied: false, pairCount: 1 };
  if (entries[0].score === entries[1].score) {
    return { winner: null, loser: null, tied: true, pairCount: 1 };
  }
  return {
    winner: entries[0].participant,
    loser: entries[1].participant,
    tied: false,
    pairCount: 1
  };
}

async function loadStandings(
  connection: PoolConnection,
  tournamentId: number,
  stage: "league" | "swiss",
  scoringSettings: unknown
) {
  const [rows] = await connection.query<StandingMatchRow[]>(`
    SELECT
      match_row.id AS match_id,match_row.home_score,match_row.away_score,
      home.player_id AS home_player_id,home.team_id AS home_team_id,home.seed AS home_seed,
      COALESCE(home_team.title,home_player.name) AS home_name,
      away.player_id AS away_player_id,away.team_id AS away_team_id,away.seed AS away_seed,
      COALESCE(away_team.title,away_player.name) AS away_name
    FROM tournament_matches match_row
    JOIN tournament_rounds round_row ON round_row.id=match_row.round_id AND round_row.stage=?
    LEFT JOIN match_participants home ON home.match_id=match_row.id AND home.slot=1
    LEFT JOIN teams home_team ON home_team.id=home.team_id
    LEFT JOIN players home_player ON home_player.id=home.player_id
    LEFT JOIN match_participants away ON away.match_id=match_row.id AND away.slot=2
    LEFT JOIN teams away_team ON away_team.id=away.team_id
    LEFT JOIN players away_player ON away_player.id=away.player_id
    WHERE match_row.tournament_id=?
      AND match_row.status='COMPLETED'
      AND match_row.home_score IS NOT NULL
      AND match_row.away_score IS NOT NULL
    ORDER BY match_row.match_number
  `, [stage, tournamentId]);

  const scoring = parseObject(scoringSettings);
  const winPoints = safeNumber(scoring.win, 3);
  const drawPoints = safeNumber(scoring.draw, 1);
  const lossPoints = safeNumber(scoring.loss, 0);
  const table = new Map<string, Omit<CompletionStanding, "rank">>();

  function apply(participant: CompletionParticipant | null, scored: number, conceded: number) {
    if (!participant) return;
    const current = table.get(participant.key) || {
      participant,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scored: 0,
      conceded: 0,
      points: 0
    };
    current.played += 1;
    current.scored += scored;
    current.conceded += conceded;
    if (scored > conceded) {
      current.wins += 1;
      current.points += winPoints;
    } else if (scored === conceded) {
      current.draws += 1;
      current.points += drawPoints;
    } else {
      current.losses += 1;
      current.points += lossPoints;
    }
    table.set(participant.key, current);
  }

  for (const row of rows) {
    const home = participantFromStanding(
      row.home_player_id,
      row.home_team_id,
      row.home_seed,
      row.home_name
    );
    const away = participantFromStanding(
      row.away_player_id,
      row.away_team_id,
      row.away_seed,
      row.away_name
    );
    apply(home, Number(row.home_score), Number(row.away_score));
    apply(away, Number(row.away_score), Number(row.home_score));
  }

  return [...table.values()]
    .sort((left, right) => (
      right.points - left.points
      || (right.scored - right.conceded) - (left.scored - left.conceded)
      || right.scored - left.scored
      || right.wins - left.wins
      || (left.participant.seed ?? Number.MAX_SAFE_INTEGER)
        - (right.participant.seed ?? Number.MAX_SAFE_INTEGER)
      || left.participant.key.localeCompare(right.participant.key)
    ))
    .map((item, index): CompletionStanding => ({ ...item, rank: index + 1 }));
}

async function loadDoubleResult(connection: PoolConnection, tournamentId: number) {
  const [participants] = await connection.query<Array<RowDataPacket & {
    player_id: number | null;
    team_id: number | null;
    seed: number | null;
    participant_name: string | null;
    losses: number;
  }>>(`
    SELECT
      entry.player_id,entry.team_id,entry.seed,
      COALESCE(team.title,player.name) AS participant_name,
      COALESCE(losses.losses,0) AS losses
    FROM registration_entries entry
    JOIN registrations registration ON registration.id=entry.registration_id
      AND registration.tournament_id=?
      AND registration.status IN ('CONFIRMED','CHECKED_IN')
      AND registration.deleted_at IS NULL
    LEFT JOIN teams team ON team.id=entry.team_id
    LEFT JOIN players player ON player.id=entry.player_id
    LEFT JOIN (
      SELECT loser.player_id,loser.team_id,COUNT(*) AS losses
      FROM tournament_matches match_row
      JOIN match_participants loser
        ON loser.match_id=match_row.id AND loser.slot<>match_row.winner_slot
      WHERE match_row.tournament_id=?
        AND match_row.status='COMPLETED'
        AND match_row.winner_slot IS NOT NULL
      GROUP BY loser.player_id,loser.team_id
    ) losses ON losses.player_id<=>entry.player_id AND losses.team_id<=>entry.team_id
    ORDER BY COALESCE(entry.seed,999999),entry.id
  `, [tournamentId, tournamentId]);

  const active = participants.filter((row) => Number(row.losses) < 2);
  const champion = active.length === 1 ? participantFromRow(active[0]) : null;
  const final = await loadRoundResult(connection, tournamentId, ["double_reset", "double_final"]);
  return {
    champion,
    runnerUp: champion ? final.loser : null,
    tied: false,
    pairCount: final.pairCount
  };
}

export async function inspectTournamentCompletion(
  connection: PoolConnection,
  tournamentId: number
): Promise<TournamentCompletionSnapshot | null> {
  const [tournamentRows] = await connection.query<TournamentRow[]>(`
    SELECT id,title,status,format,scoring_settings
    FROM tournaments
    WHERE id=? AND deleted_at IS NULL
    LIMIT 1
  `, [tournamentId]);
  const tournament = tournamentRows[0];
  if (!tournament) return null;

  const [summaryRows] = await connection.query<MatchSummaryRow[]>(`
    SELECT
      COUNT(*) AS total_matches,
      COALESCE(SUM(status='COMPLETED'),0) AS completed_matches,
      COALESCE(SUM(status NOT IN ('COMPLETED','CANCELLED')),0) AS remaining_matches,
      COALESCE(SUM(status='CANCELLED' AND winner_slot IS NULL),0) AS unresolved_cancelled
    FROM tournament_matches
    WHERE tournament_id=?
  `, [tournamentId]);
  const summary = summaryRows[0];
  const totalMatches = Number(summary?.total_matches || 0);
  const completedMatches = Number(summary?.completed_matches || 0);
  const remainingMatches = Number(summary?.remaining_matches || 0);
  const unresolvedCancelledMatches = Number(summary?.unresolved_cancelled || 0);

  const [disputeRows] = await connection.query<Array<RowDataPacket & { count: number }>>(`
    SELECT COUNT(*) AS count
    FROM match_disputes dispute
    JOIN tournament_matches match_row ON match_row.id=dispute.match_id
    WHERE match_row.tournament_id=? AND dispute.status IN ('open','accepted')
  `, [tournamentId]);
  const openDisputes = Number(disputeRows[0]?.count || 0);
  const category = categoryOf(tournament.format);

  let champion: CompletionParticipant | null = null;
  let runnerUp: CompletionParticipant | null = null;
  let thirdPlace: CompletionParticipant | null = null;
  let standings: CompletionStanding[] = [];
  let tiedFinal = false;

  if (category === "league" || category === "swiss") {
    standings = await loadStandings(connection, tournamentId, category, tournament.scoring_settings);
    champion = standings[0]?.participant || null;
    runnerUp = standings[1]?.participant || null;
    thirdPlace = standings[2]?.participant || null;
  } else if (category === "double") {
    const result = await loadDoubleResult(connection, tournamentId);
    champion = result.champion;
    runnerUp = result.runnerUp;
  } else {
    const final = await loadRoundResult(connection, tournamentId, ["knockout"]);
    champion = final.winner;
    runnerUp = final.loser;
    tiedFinal = final.tied;
    const third = await loadRoundResult(connection, tournamentId, ["third_place"]);
    thirdPlace = third.winner;
  }

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (tournament.status === "CANCELLED") blockers.push("مسابقه لغو شده است.");
  if (!["DRAW_READY", "RUNNING", "COMPLETED"].includes(tournament.status)) {
    blockers.push("وضعیت مسابقه هنوز برای پایان نهایی مناسب نیست.");
  }
  if (!totalMatches) blockers.push("هنوز بازی‌ای برای این مسابقه ساخته نشده است.");
  if (remainingMatches) blockers.push(`${remainingMatches.toLocaleString("fa-IR")} بازی هنوز پایان نیافته است.`);
  if (unresolvedCancelledMatches) blockers.push("حداقل یک بازی لغوشده بدون نتیجه تعیین‌کننده وجود دارد.");
  if (openDisputes) blockers.push(`${openDisputes.toLocaleString("fa-IR")} اعتراض باز باید تعیین تکلیف شود.`);
  if (tiedFinal) blockers.push("نتیجه مجموع فینال مساوی است و قهرمان مشخص نشده است.");
  if (!champion) blockers.push("قهرمان نهایی هنوز قابل تشخیص نیست.");

  if (standings.length >= 2) {
    const first = standings[0];
    const second = standings[1];
    const sameCompetitiveScore = first.points === second.points
      && first.scored - first.conceded === second.scored - second.conceded
      && first.scored === second.scored
      && first.wins === second.wins;
    if (sameCompetitiveScore) {
      warnings.push("رتبه اول با معیار Seed یا ترتیب پایدار سیستم از رتبه دوم جدا شده است.");
    }
  }

  const completed = tournament.status === "COMPLETED";
  const readyToFinalize = !completed && blockers.length === 0;
  return {
    tournamentId: Number(tournament.id),
    title: tournament.title,
    status: tournament.status,
    format: tournament.format,
    category,
    totalMatches,
    completedMatches,
    remainingMatches,
    openDisputes,
    unresolvedCancelledMatches,
    progressPercent: totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0,
    champion,
    runnerUp,
    thirdPlace,
    standings,
    blockers,
    warnings,
    readyToFinalize,
    completed
  };
}

export async function getTournamentCompletionSnapshot(tournamentId: number) {
  const connection = await db.getConnection();
  try {
    return await inspectTournamentCompletion(connection, tournamentId);
  } finally {
    connection.release();
  }
}

export async function finalizeTournament(
  connection: PoolConnection,
  tournamentId: number
) {
  const [locked] = await connection.query<RowDataPacket[]>(`
    SELECT id FROM tournaments WHERE id=? AND deleted_at IS NULL LIMIT 1 FOR UPDATE
  `, [tournamentId]);
  if (!locked[0]) throw new Error("TOURNAMENT_NOT_FOUND");

  const snapshot = await inspectTournamentCompletion(connection, tournamentId);
  if (!snapshot) throw new Error("TOURNAMENT_NOT_FOUND");
  if (snapshot.completed) return snapshot;
  if (!snapshot.readyToFinalize) throw new Error("TOURNAMENT_NOT_READY_TO_COMPLETE");

  await connection.execute(`
    UPDATE tournaments SET status='COMPLETED',updated_at=NOW() WHERE id=?
  `, [tournamentId]);
  return { ...snapshot, status: "COMPLETED", completed: true, readyToFinalize: false };
}

export async function listCompletedTournamentChampions(limit = 30) {
  const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT id
      FROM tournaments
      WHERE status='COMPLETED' AND deleted_at IS NULL
      ORDER BY updated_at DESC,id DESC
      LIMIT ${safeLimit}
    `);
    const snapshots: TournamentCompletionSnapshot[] = [];
    for (const row of rows) {
      const snapshot = await inspectTournamentCompletion(connection, Number(row.id));
      if (snapshot?.champion && snapshot.openDisputes === 0) snapshots.push(snapshot);
    }
    return snapshots;
  } finally {
    connection.release();
  }
}
