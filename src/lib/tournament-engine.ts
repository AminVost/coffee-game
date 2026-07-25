import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import { planKnockout, type PlannedPairing } from "@/lib/draw-planner";

type Participant = {
  playerId: number | null;
  teamId: number | null;
  seed: number | null;
  key: string;
};

type TournamentRow = RowDataPacket & {
  id: number;
  game_id: number;
  min_participants: number;
  format: string;
  draw_mode: string;
  has_third_place: number;
  starts_at: Date;
  venue_id: number | null;
  game_settings: unknown;
  scoring_settings: unknown;
  status: string;
  title: string;
  game_slug: string;
};

type Standing = {
  participant: Participant;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  points: number;
};

type TournamentCategory = "knockout" | "league" | "group" | "swiss" | "double";

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

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}

function participantKey(playerId: number | null, teamId: number | null) {
  return playerId ? `p:${playerId}` : `t:${teamId}`;
}

function formatCategory(format: string): TournamentCategory {
  const normalized = format.toLowerCase();
  if (normalized.includes("گروه") || normalized.includes("group")) return "group";
  if (normalized.includes("سوئیس") || normalized.includes("swiss")) return "swiss";
  if (normalized.includes("دوحذفی") || normalized.includes("double elimination")) return "double";
  if (normalized.includes("لیگ") || normalized.includes("round robin")) return "league";
  return "knockout";
}

function isTwoLegged(format: string) {
  const normalized = format.toLowerCase();
  return (
    normalized.includes("رفت‌وبرگشت")
    || normalized.includes("رفت و برگشت")
    || normalized.includes("home and away")
    || normalized.includes("two leg")
  );
}

function isDoubleRoundRobin(format: string) {
  return formatCategory(format) === "league" && isTwoLegged(format);
}

async function loadTournament(connection: PoolConnection, tournamentId: number) {
  const [rows] = await connection.query<TournamentRow[]>(`
    SELECT t.*,g.slug AS game_slug
    FROM tournaments t
    JOIN games g ON g.id=t.game_id
    WHERE t.id=? AND t.deleted_at IS NULL
    LIMIT 1
    FOR UPDATE
  `, [tournamentId]);
  return rows[0] || null;
}

async function loadParticipants(connection: PoolConnection, tournamentId: number) {
  const [rows] = await connection.query<Array<RowDataPacket & {
    player_id: number | null;
    team_id: number | null;
    seed: number | null;
  }>>(`
    SELECT re.player_id,re.team_id,re.seed
    FROM registration_entries re
    JOIN registrations r ON r.id=re.registration_id
    WHERE r.tournament_id=?
      AND r.deleted_at IS NULL
      AND r.status IN ('CONFIRMED','CHECKED_IN')
    ORDER BY COALESCE(re.seed,999999),re.id
    FOR UPDATE
  `, [tournamentId]);

  return rows
    .map((row): Participant => ({
      playerId: row.player_id ? Number(row.player_id) : null,
      teamId: row.team_id ? Number(row.team_id) : null,
      seed: row.seed === null ? null : Number(row.seed),
      key: participantKey(row.player_id, row.team_id)
    }))
    .filter((row) => Boolean(row.playerId || row.teamId));
}

async function nextMatchNumber(connection: PoolConnection, tournamentId: number) {
  const [rows] = await connection.query<Array<RowDataPacket & { next_number: number }>>(`
    SELECT COALESCE(MAX(match_number),0)+1 AS next_number
    FROM tournament_matches
    WHERE tournament_id=?
    FOR UPDATE
  `, [tournamentId]);
  return Number(rows[0]?.next_number || 1);
}

async function createRound(
  connection: PoolConnection,
  tournamentId: number,
  title: string,
  roundNumber: number,
  stage: string,
  startsAt: Date | null,
  configuration: unknown = {}
) {
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO tournament_rounds(tournament_id,title,round_number,stage,starts_at,configuration)
    VALUES(?,?,?,?,?,?)
  `, [tournamentId, title, roundNumber, stage, startsAt, JSON.stringify(configuration)]);
  return result.insertId;
}

async function createMatch(
  connection: PoolConnection,
  tournamentId: number,
  roundId: number,
  matchNumber: number,
  home: Participant | null,
  away: Participant | null,
  options: { pairKey?: string | null; legNumber?: number; status?: string } = {}
) {
  if (!home && !away) return null;

  const bye = Boolean((home && !away) || (!home && away));
  const actualHome = home || away;
  const winnerSlot = bye ? 1 : null;
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO tournament_matches(
      public_id,tournament_id,round_id,match_number,status,
      home_score,away_score,winner_slot,completed_at,pair_key,leg_number
    )
    VALUES(UUID(),?,?,?,?,?,?,?,?,?,?)
  `, [
    tournamentId,
    roundId,
    matchNumber,
    bye ? "COMPLETED" : options.status || "PENDING",
    bye ? 1 : null,
    bye ? 0 : null,
    winnerSlot,
    bye ? new Date() : null,
    options.pairKey || null,
    options.legNumber || 1
  ]);

  if (actualHome) {
    await connection.execute(`
      INSERT INTO match_participants(match_id,slot,player_id,team_id,seed,is_winner)
      VALUES(?,1,?,?,?,?)
    `, [result.insertId, actualHome.playerId, actualHome.teamId, actualHome.seed, bye ? 1 : 0]);
  }
  if (away && home) {
    await connection.execute(`
      INSERT INTO match_participants(match_id,slot,player_id,team_id,seed,is_winner)
      VALUES(?,2,?,?,?,0)
    `, [result.insertId, away.playerId, away.teamId, away.seed]);
  }

  return result.insertId;
}

function adjacentKnockoutPairings(participants: Participant[]) {
  const list: Array<Participant | null> = [...participants];
  while (list.length > 2 && (list.length & (list.length - 1)) !== 0) list.push(null);
  const pairings: PlannedPairing[] = [];
  for (let index = 0; index < list.length; index += 2) {
    pairings.push({
      homeKey: list[index]?.key || null,
      awayKey: list[index + 1]?.key || null
    });
  }
  return pairings;
}

async function createKnockoutRound(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[],
  roundNumber: number,
  title: string,
  stage = "knockout",
  forceSingleLeg = false,
  requestedPairings?: PlannedPairing[]
) {
  const twoLegged = !forceSingleLeg && isTwoLegged(tournament.format);
  const pairings = requestedPairings || adjacentKnockoutPairings(participants);
  const byKey = new Map(participants.map((participant) => [participant.key, participant]));
  const roundId = await createRound(
    connection,
    tournament.id,
    title,
    roundNumber,
    stage,
    roundNumber === 1 ? new Date(tournament.starts_at) : null,
    {
      participantCount: participants.length,
      twoLegged,
      pairingCount: pairings.length,
      drawMode: tournament.draw_mode
    }
  );
  let matchNumber = await nextMatchNumber(connection, tournament.id);

  for (let index = 0; index < pairings.length; index += 1) {
    const pairing = pairings[index];
    const home = pairing.homeKey ? byKey.get(pairing.homeKey) || null : null;
    const away = pairing.awayKey ? byKey.get(pairing.awayKey) || null : null;
    if (!home && !away) continue;
    const pairKey = `${stage}:${roundNumber}:${index + 1}`;
    await createMatch(connection, tournament.id, roundId, matchNumber++, home, away, {
      pairKey,
      legNumber: 1
    });
    if (twoLegged && home && away) {
      await createMatch(connection, tournament.id, roundId, matchNumber++, away, home, {
        pairKey,
        legNumber: 2
      });
    }
  }
  return roundId;
}

async function createRoundRobin(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[],
  reverse: boolean,
  stage: string,
  titlePrefix: string
) {
  const list: Array<Participant | null> = [...participants];
  if (list.length % 2) list.push(null);
  const participantCount = list.length;
  const firstLegRounds = participantCount - 1;
  const roundCount = firstLegRounds * (reverse ? 2 : 1);
  let matchNumber = await nextMatchNumber(connection, tournament.id);
  let rotation = [...list];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const firstLegIndex = roundIndex % firstLegRounds;
    if (firstLegIndex === 0 && roundIndex > 0) rotation = [...list];
    const roundNumber = roundIndex + 1;
    const roundId = await createRound(
      connection,
      tournament.id,
      `${titlePrefix} ${roundNumber}`,
      roundNumber,
      stage,
      new Date(new Date(tournament.starts_at).getTime() + roundIndex * 60 * 60 * 1000),
      { reverse }
    );

    for (let pairIndex = 0; pairIndex < participantCount / 2; pairIndex += 1) {
      let home = rotation[pairIndex];
      let away = rotation[participantCount - 1 - pairIndex];
      if (roundIndex >= firstLegRounds) [home, away] = [away, home];
      if (home && away) {
        await createMatch(connection, tournament.id, roundId, matchNumber++, home, away, {
          pairKey: `${stage}:${roundNumber}:${pairIndex + 1}`
        });
      }
    }

    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
}

async function createGroupStage(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[]
) {
  const settings = parseObject(tournament.game_settings);
  const requestedGroupSize = Math.round(safeNumber(settings.groupSize, 4, 3, 8));
  const groupCount = Math.max(1, Math.ceil(participants.length / requestedGroupSize));
  const groups = Array.from({ length: groupCount }, () => [] as Participant[]);
  participants.forEach((participant, index) => {
    const row = Math.floor(index / groupCount);
    const column = index % groupCount;
    const groupIndex = row % 2 === 0 ? column : groupCount - 1 - column;
    groups[groupIndex].push(participant);
  });

  for (let index = 0; index < groups.length; index += 1) {
    const groupName = String.fromCharCode(65 + index);
    await createRoundRobin(
      connection,
      tournament,
      groups[index],
      false,
      `group_${groupName}`,
      `گروه ${groupName} - دور`
    );
  }
}

async function previousPairs(connection: PoolConnection, tournamentId: number) {
  const [rows] = await connection.query<Array<RowDataPacket & { home_key: string; away_key: string }>>(`
    SELECT
      CONCAT(IF(home.player_id IS NULL,'t:','p:'),COALESCE(home.player_id,home.team_id)) AS home_key,
      CONCAT(IF(away.player_id IS NULL,'t:','p:'),COALESCE(away.player_id,away.team_id)) AS away_key
    FROM tournament_matches m
    JOIN match_participants home ON home.match_id=m.id AND home.slot=1
    JOIN match_participants away ON away.match_id=m.id AND away.slot=2
    WHERE m.tournament_id=?
  `, [tournamentId]);
  return new Set(rows.flatMap((row) => [
    `${row.home_key}|${row.away_key}`,
    `${row.away_key}|${row.home_key}`
  ]));
}

async function createSwissRound(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[],
  roundNumber: number
) {
  const standings = await standingsFromMatches(connection, tournament.id, "swiss");
  const standingByKey = new Map(standings.map((standing) => [standing.participant.key, standing]));
  const previous = await previousPairs(connection, tournament.id);
  const opponents = new Map<string, Set<string>>();
  const byeCount = new Map<string, number>();

  const [historyRows] = await connection.query<Array<RowDataPacket & {
    match_id: number;
    player_id: number | null;
    team_id: number | null;
  }>>(`
    SELECT m.id AS match_id,mp.player_id,mp.team_id
    FROM tournament_matches m
    JOIN tournament_rounds r ON r.id=m.round_id AND r.stage='swiss'
    JOIN match_participants mp ON mp.match_id=m.id
    WHERE m.tournament_id=? AND m.status='COMPLETED'
    ORDER BY m.id,mp.slot
  `, [tournament.id]);

  const byMatch = new Map<number, string[]>();
  for (const row of historyRows) {
    const keys = byMatch.get(Number(row.match_id)) || [];
    keys.push(participantKey(row.player_id, row.team_id));
    byMatch.set(Number(row.match_id), keys);
  }
  for (const keys of byMatch.values()) {
    if (keys.length === 1) {
      byeCount.set(keys[0], (byeCount.get(keys[0]) || 0) + 1);
      continue;
    }
    if (keys.length >= 2) {
      const [first, second] = keys;
      const firstOpponents = opponents.get(first) || new Set<string>();
      const secondOpponents = opponents.get(second) || new Set<string>();
      firstOpponents.add(second);
      secondOpponents.add(first);
      opponents.set(first, firstOpponents);
      opponents.set(second, secondOpponents);
    }
  }

  const pointsOf = (key: string) => standingByKey.get(key)?.points || 0;
  const buchholzOf = (key: string) => [...(opponents.get(key) || [])]
    .reduce((sum, opponentKey) => sum + pointsOf(opponentKey), 0);
  const ordered = [...participants].sort((left, right) => {
    const leftStanding = standingByKey.get(left.key);
    const rightStanding = standingByKey.get(right.key);
    return (
      pointsOf(right.key) - pointsOf(left.key)
      || buchholzOf(right.key) - buchholzOf(left.key)
      || ((rightStanding?.scored || 0) - (rightStanding?.conceded || 0))
        - ((leftStanding?.scored || 0) - (leftStanding?.conceded || 0))
      || (left.seed ?? Number.MAX_SAFE_INTEGER) - (right.seed ?? Number.MAX_SAFE_INTEGER)
      || left.key.localeCompare(right.key)
    );
  });

  let bye: Participant | null = null;
  if (ordered.length % 2) {
    const reversed = [...ordered].reverse();
    bye = reversed.find((participant) => (byeCount.get(participant.key) || 0) === 0)
      || reversed.sort((left, right) => (byeCount.get(left.key) || 0) - (byeCount.get(right.key) || 0))[0]
      || null;
    if (bye) ordered.splice(ordered.findIndex((participant) => participant.key === bye?.key), 1);
  }

  const pairings: Array<[Participant, Participant | null]> = [];
  while (ordered.length) {
    const home = ordered.shift()!;
    let bestIndex = 0;
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (let index = 0; index < ordered.length; index += 1) {
      const candidate = ordered[index];
      const repeated = previous.has(`${home.key}|${candidate.key}`) ? 1 : 0;
      const scoreGap = Math.abs(pointsOf(home.key) - pointsOf(candidate.key));
      const buchholzGap = Math.abs(buchholzOf(home.key) - buchholzOf(candidate.key));
      const penalty = repeated * 1_000_000 + scoreGap * 10_000 + buchholzGap * 100 + index;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    }
    pairings.push([home, ordered.splice(bestIndex, 1)[0] || null]);
  }
  if (bye) pairings.push([bye, null]);

  const roundId = await createRound(
    connection,
    tournament.id,
    `دور سوئیسی ${roundNumber}`,
    roundNumber,
    "swiss",
    roundNumber === 1 ? new Date(tournament.starts_at) : null,
    { pairing: "score-group", buchholz: true, avoidsRepeat: true }
  );
  let matchNumber = await nextMatchNumber(connection, tournament.id);
  for (let index = 0; index < pairings.length; index += 1) {
    const [home, away] = pairings[index];
    await createMatch(connection, tournament.id, roundId, matchNumber++, home, away, {
      pairKey: `swiss:${roundNumber}:${index + 1}`
    });
  }
}

async function createDoubleEliminationRound(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[],
  roundNumber: number,
  stage: "double_winners" | "double_losers" | "double_final" | "double_reset" = "double_winners",
  requestedPairings?: PlannedPairing[]
) {
  const previous = await previousPairs(connection, tournament.id);
  const byKey = new Map(participants.map((participant) => [participant.key, participant]));
  const pairings: PlannedPairing[] = [];

  if (requestedPairings) {
    pairings.push(...requestedPairings);
  } else {
    const remaining = [...participants];
    while (remaining.length) {
      const home = remaining.shift()!;
      let opponentIndex = remaining.findIndex(
        (candidate) => !previous.has(`${home.key}|${candidate.key}`)
      );
      if (opponentIndex < 0) opponentIndex = 0;
      const away = remaining.splice(opponentIndex, 1)[0] || null;
      pairings.push({ homeKey: home.key, awayKey: away?.key || null });
    }
  }

  const title = stage === "double_winners"
    ? `براکت برندگان - دور ${roundNumber}`
    : stage === "double_losers"
      ? `براکت بازندگان - دور ${roundNumber}`
      : stage === "double_final"
        ? "فینال دوحذفی"
        : "فینال مجدد دوحذفی";
  const roundId = await createRound(
    connection,
    tournament.id,
    title,
    roundNumber,
    stage,
    roundNumber === 1 ? new Date(tournament.starts_at) : null,
    { bracket: stage }
  );
  let matchNumber = await nextMatchNumber(connection, tournament.id);

  for (let index = 0; index < pairings.length; index += 1) {
    const pairing = pairings[index];
    const home = pairing.homeKey ? byKey.get(pairing.homeKey) || null : null;
    const away = pairing.awayKey ? byKey.get(pairing.awayKey) || null : null;
    if (!home && !away) continue;
    await createMatch(connection, tournament.id, roundId, matchNumber++, home, away, {
      pairKey: `${stage}:${roundNumber}:${index + 1}`
    });
  }
}

async function standingsFromMatches(
  connection: PoolConnection,
  tournamentId: number,
  stageFilter: string
) {
  const [rows] = await connection.query<Array<RowDataPacket & {
    player_id: number | null;
    team_id: number | null;
    slot: number;
    home_score: number;
    away_score: number;
  }>>(`
    SELECT mp.player_id,mp.team_id,mp.slot,m.home_score,m.away_score
    FROM tournament_matches m
    JOIN tournament_rounds r ON r.id=m.round_id
    JOIN match_participants mp ON mp.match_id=m.id
    WHERE m.tournament_id=?
      AND m.status='COMPLETED'
      AND r.stage LIKE ?
  `, [tournamentId, stageFilter]);

  const standings = new Map<string, Standing>();
  for (const row of rows) {
    const key = participantKey(row.player_id, row.team_id);
    const current = standings.get(key) || {
      participant: {
        playerId: row.player_id ? Number(row.player_id) : null,
        teamId: row.team_id ? Number(row.team_id) : null,
        seed: null,
        key
      },
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scored: 0,
      conceded: 0,
      points: 0
    };
    const scored = row.slot === 1 ? Number(row.home_score) : Number(row.away_score);
    const conceded = row.slot === 1 ? Number(row.away_score) : Number(row.home_score);
    current.played += 1;
    current.scored += scored;
    current.conceded += conceded;
    if (scored > conceded) {
      current.wins += 1;
      current.points += 3;
    } else if (scored === conceded) {
      current.draws += 1;
      current.points += 1;
    } else {
      current.losses += 1;
    }
    standings.set(key, current);
  }

  return [...standings.values()].sort((left, right) => (
    right.points - left.points
    || (right.scored - right.conceded) - (left.scored - left.conceded)
    || right.scored - left.scored
    || left.participant.key.localeCompare(right.participant.key)
  ));
}

async function resolveKnockoutRound(
  connection: PoolConnection,
  roundId: number
) {
  const [matches] = await connection.query<Array<RowDataPacket & {
    id: number;
    pair_key: string | null;
    leg_number: number;
    home_score: number;
    away_score: number;
  }>>(`
    SELECT id,pair_key,leg_number,home_score,away_score
    FROM tournament_matches
    WHERE round_id=? AND status='COMPLETED'
    ORDER BY match_number
  `, [roundId]);

  const pairOrder: string[] = [];
  const aggregates = new Map<string, Map<string, { participant: Participant; score: number }>>();
  const losers = new Map<string, Participant>();

  for (const match of matches) {
    const pairKey = match.pair_key || `match:${match.id}`;
    if (!aggregates.has(pairKey)) {
      aggregates.set(pairKey, new Map());
      pairOrder.push(pairKey);
    }
    const [parts] = await connection.query<Array<RowDataPacket & {
      slot: number;
      player_id: number | null;
      team_id: number | null;
      seed: number | null;
    }>>(`
      SELECT slot,player_id,team_id,seed
      FROM match_participants
      WHERE match_id=?
      ORDER BY slot
    `, [match.id]);

    for (const part of parts) {
      const key = participantKey(part.player_id, part.team_id);
      const score = part.slot === 1 ? Number(match.home_score) : Number(match.away_score);
      const map = aggregates.get(pairKey)!;
      const existing = map.get(key) || {
        participant: {
          playerId: part.player_id ? Number(part.player_id) : null,
          teamId: part.team_id ? Number(part.team_id) : null,
          seed: part.seed === null ? null : Number(part.seed),
          key
        },
        score: 0
      };
      existing.score += score;
      map.set(key, existing);
    }
  }

  const winners: Participant[] = [];
  for (const pairKey of pairOrder) {
    const entries = [...(aggregates.get(pairKey)?.values() || [])];
    if (entries.length === 1) {
      winners.push(entries[0].participant);
      continue;
    }
    entries.sort((left, right) => right.score - left.score);
    if (entries[0].score === entries[1].score) throw new Error("AGGREGATE_TIE");
    winners.push(entries[0].participant);
    losers.set(pairKey, entries[1].participant);
  }

  return { winners, losers: [...losers.values()] };
}

async function recomputeDoubleState(connection: PoolConnection, tournamentId: number) {
  await connection.execute(`
    UPDATE tournament_participant_state
    SET losses=0,eliminated=0,updated_at=NOW()
    WHERE tournament_id=?
  `, [tournamentId]);

  const [losers] = await connection.query<Array<RowDataPacket & {
    player_id: number | null;
    team_id: number | null;
    losses: number;
  }>>(`
    SELECT mp.player_id,mp.team_id,COUNT(*) AS losses
    FROM tournament_matches m
    JOIN match_participants mp ON mp.match_id=m.id AND mp.slot<>m.winner_slot
    WHERE m.tournament_id=? AND m.status='COMPLETED' AND m.winner_slot IS NOT NULL
    GROUP BY mp.player_id,mp.team_id
  `, [tournamentId]);

  for (const row of losers) {
    await connection.execute(`
      UPDATE tournament_participant_state
      SET losses=?,eliminated=IF(? >= 2,1,0),updated_at=NOW()
      WHERE tournament_id=? AND player_id<=>? AND team_id<=>?
    `, [row.losses, row.losses, tournamentId, row.player_id, row.team_id]);
  }
}

export type TournamentDrawOptions = {
  participantOrder?: string[];
  manualPairings?: PlannedPairing[];
};

function drawMode(value: string): "random" | "seeded" | "custom" {
  return value === "seeded" || value === "custom" ? value : "random";
}

function participantsFromOrder(participants: Participant[], orderedKeys: string[]) {
  const byKey = new Map(participants.map((participant) => [participant.key, participant]));
  return orderedKeys.map((key) => {
    const participant = byKey.get(key);
    if (!participant) throw new Error("INVALID_PARTICIPANT_ORDER");
    return participant;
  });
}

function buildInitialPlan(
  tournament: TournamentRow,
  participants: Participant[],
  options: TournamentDrawOptions = {}
) {
  const category = formatCategory(tournament.format);
  const knockoutPlan = planKnockout(participants, drawMode(tournament.draw_mode), {
    participantOrder: options.participantOrder,
    manualPairings: category === "knockout" || category === "double"
      ? options.manualPairings
      : undefined
  });
  const plan = category === "knockout" || category === "double"
    ? knockoutPlan
    : { ...knockoutPlan, slots: knockoutPlan.orderedKeys, pairings: [] };
  return {
    category,
    plan,
    orderedParticipants: participantsFromOrder(participants, plan.orderedKeys)
  };
}

async function ensureDrawCanBeCreated(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[]
) {
  if (tournament.status !== "REGISTRATION_CLOSED") {
    throw new Error("TOURNAMENT_NOT_READY_FOR_DRAW");
  }
  if (participants.length < Math.max(2, Number(tournament.min_participants || 2))) {
    throw new Error("MINIMUM_PARTICIPANTS_NOT_REACHED");
  }
  const [existing] = await connection.query<RowDataPacket[]>(`
    SELECT id FROM tournament_matches WHERE tournament_id=? LIMIT 1
  `, [tournament.id]);
  if (existing[0]) throw new Error("DRAW_ALREADY_EXISTS");
}

async function createInitialDraw(
  connection: PoolConnection,
  tournament: TournamentRow,
  participants: Participant[],
  options: TournamentDrawOptions = {}
) {
  await ensureDrawCanBeCreated(connection, tournament, participants);
  const { category, plan, orderedParticipants } = buildInitialPlan(tournament, participants, options);

  if (category === "league") {
    await createRoundRobin(
      connection,
      tournament,
      orderedParticipants,
      isDoubleRoundRobin(tournament.format),
      "league",
      "هفته"
    );
  } else if (category === "group") {
    await createGroupStage(connection, tournament, orderedParticipants);
  } else if (category === "swiss") {
    await createSwissRound(connection, tournament, orderedParticipants, 1);
  } else if (category === "double") {
    for (const participant of orderedParticipants) {
      await connection.execute(`
        INSERT INTO tournament_participant_state(
          tournament_id,player_id,team_id,losses,eliminated,updated_at
        ) VALUES(?,?,?,?,0,NOW())
      `, [tournament.id, participant.playerId, participant.teamId, 0]);
    }
    await createDoubleEliminationRound(
      connection,
      tournament,
      orderedParticipants,
      1,
      "double_winners",
      plan.pairings
    );
  } else {
    await createKnockoutRound(
      connection,
      tournament,
      orderedParticipants,
      1,
      "دور اول",
      "knockout",
      false,
      plan.pairings
    );
  }

  await connection.execute(`
    UPDATE tournaments SET status='DRAW_READY',updated_at=NOW() WHERE id=?
  `, [tournament.id]);
  return {
    participants: participants.length,
    category,
    bracketSize: plan.bracketSize,
    orderedKeys: plan.orderedKeys,
    pairings: plan.pairings,
    warnings: plan.warnings
  };
}

async function resetDrawInTransaction(connection: PoolConnection, tournamentId: number) {
  const [lockedMatches] = await connection.query<RowDataPacket[]>(`
    SELECT id
    FROM tournament_matches
    WHERE tournament_id=?
      AND (status IN ('LIVE','COMPLETED') OR started_at IS NOT NULL OR completed_at IS NOT NULL)
    LIMIT 1
    FOR UPDATE
  `, [tournamentId]);
  if (lockedMatches[0]) throw new Error("DRAW_RESET_LOCKED");

  const [disputes] = await connection.query<RowDataPacket[]>(`
    SELECT d.id
    FROM match_disputes d
    JOIN tournament_matches m ON m.id=d.match_id
    WHERE m.tournament_id=?
    LIMIT 1
    FOR UPDATE
  `, [tournamentId]);
  if (disputes[0]) throw new Error("DRAW_HAS_DISPUTES");

  await connection.execute(`
    DELETE mp FROM match_participants mp
    JOIN tournament_matches m ON m.id=mp.match_id
    WHERE m.tournament_id=?
  `, [tournamentId]);
  await connection.execute(`DELETE FROM tournament_matches WHERE tournament_id=?`, [tournamentId]);
  await connection.execute(`DELETE FROM tournament_rounds WHERE tournament_id=?`, [tournamentId]);
  await connection.execute(`DELETE FROM tournament_participant_state WHERE tournament_id=?`, [tournamentId]);
  await connection.execute(`
    UPDATE tournaments SET status='REGISTRATION_CLOSED',updated_at=NOW() WHERE id=?
  `, [tournamentId]);
}

export async function previewTournamentDraw(
  tournamentId: number,
  options: TournamentDrawOptions = {}
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tournament = await loadTournament(connection, tournamentId);
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (!["REGISTRATION_CLOSED", "DRAW_READY"].includes(tournament.status)) {
      throw new Error("TOURNAMENT_NOT_READY_FOR_DRAW");
    }
    const participants = await loadParticipants(connection, tournament.id);
    if (participants.length < Math.max(2, Number(tournament.min_participants || 2))) {
      throw new Error("MINIMUM_PARTICIPANTS_NOT_REACHED");
    }
    const { category, plan } = buildInitialPlan(tournament, participants, options);
    await connection.rollback();
    return {
      participants: participants.length,
      minimumParticipants: Number(tournament.min_participants || 2),
      category,
      drawMode: drawMode(tournament.draw_mode),
      ...plan
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function generateTournamentDraw(
  tournamentId: number,
  options: TournamentDrawOptions = {}
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tournament = await loadTournament(connection, tournamentId);
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    const participants = await loadParticipants(connection, tournament.id);
    const result = await createInitialDraw(connection, tournament, participants, options);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function resetTournamentDraw(tournamentId: number) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tournament = await loadTournament(connection, tournamentId);
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    await resetDrawInTransaction(connection, tournament.id);
    await connection.commit();
    return { reset: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function regenerateTournamentDraw(
  tournamentId: number,
  options: TournamentDrawOptions = {}
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tournament = await loadTournament(connection, tournamentId);
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    await resetDrawInTransaction(connection, tournament.id);
    tournament.status = "REGISTRATION_CLOSED";
    const participants = await loadParticipants(connection, tournament.id);
    const result = await createInitialDraw(connection, tournament, participants, options);
    await connection.commit();
    return { ...result, regenerated: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function advanceTournament(connection: PoolConnection, tournamentId: number) {
  const tournament = await loadTournament(connection, tournamentId);
  if (!tournament || tournament.status === "COMPLETED") return { advanced: false };

  const [pending] = await connection.query<RowDataPacket[]>(`
    SELECT id FROM tournament_matches
    WHERE tournament_id=? AND status NOT IN ('COMPLETED','CANCELLED')
    LIMIT 1
  `, [tournament.id]);
  if (pending[0]) return { advanced: false };

  const category = formatCategory(tournament.format);
  if (category === "league") {
    await connection.execute(`UPDATE tournaments SET status='COMPLETED',updated_at=NOW() WHERE id=?`, [tournament.id]);
    return { advanced: true, completed: true };
  }

  if (category === "group") {
    const [knockoutRows] = await connection.query<RowDataPacket[]>(`
      SELECT id FROM tournament_rounds
      WHERE tournament_id=? AND stage='knockout'
      LIMIT 1
    `, [tournament.id]);
    if (!knockoutRows[0]) {
      const [stageRows] = await connection.query<Array<RowDataPacket & { stage: string }>>(`
        SELECT DISTINCT stage
        FROM tournament_rounds
        WHERE tournament_id=? AND stage LIKE 'group_%'
        ORDER BY stage
      `, [tournament.id]);
      const settings = parseObject(tournament.game_settings);
      const qualifiersPerGroup = Math.round(safeNumber(settings.groupQualifiers, 2, 1, 4));
      const groupTables: Participant[][] = [];
      for (const stageRow of stageRows) {
        const table = await standingsFromMatches(connection, tournament.id, stageRow.stage);
        groupTables.push(table.slice(0, qualifiersPerGroup).map((standing) => standing.participant));
      }
      const qualified: Participant[] = [];
      for (let rank = 0; rank < qualifiersPerGroup; rank += 1) {
        const row = groupTables
          .map((table) => table[rank])
          .filter((participant): participant is Participant => Boolean(participant));
        if (rank % 2) row.reverse();
        qualified.push(...row);
      }
      if (qualified.length < 2) throw new Error("NOT_ENOUGH_QUALIFIED_PARTICIPANTS");
      const knockoutPlan = planKnockout(qualified, "custom", {
        participantOrder: qualified.map((participant) => participant.key)
      });
      await createKnockoutRound(
        connection,
        tournament,
        qualified,
        1,
        "مرحله حذفی",
        "knockout",
        false,
        knockoutPlan.pairings
      );
      return { advanced: true, completed: false };
    }
  }

  if (category === "swiss") {
    const [roundRows] = await connection.query<Array<RowDataPacket & { round_number: number }>>(`
      SELECT COALESCE(MAX(round_number),1) AS round_number
      FROM tournament_rounds
      WHERE tournament_id=? AND stage='swiss'
    `, [tournament.id]);
    const currentRound = Number(roundRows[0]?.round_number || 1);
    const participants = await loadParticipants(connection, tournament.id);
    const settings = parseObject(tournament.game_settings);
    const defaultRounds = Math.ceil(Math.log2(Math.max(2, participants.length))) + 1;
    const maximumRounds = Math.round(safeNumber(settings.swissRounds, defaultRounds, 2, 20));
    if (currentRound < maximumRounds) {
      await createSwissRound(connection, tournament, participants, currentRound + 1);
      return { advanced: true, completed: false };
    }
    await connection.execute(`UPDATE tournaments SET status='COMPLETED',updated_at=NOW() WHERE id=?`, [tournament.id]);
    return { advanced: true, completed: true };
  }

  if (category === "double") {
    await recomputeDoubleState(connection, tournament.id);
    const [activeRows] = await connection.query<Array<RowDataPacket & {
      player_id: number | null;
      team_id: number | null;
      losses: number;
      seed: number | null;
    }>>(`
      SELECT state.player_id,state.team_id,state.losses,re.seed
      FROM tournament_participant_state state
      LEFT JOIN registrations reg ON reg.tournament_id=state.tournament_id
        AND reg.status IN ('CONFIRMED','CHECKED_IN') AND reg.deleted_at IS NULL
      LEFT JOIN registration_entries re ON re.registration_id=reg.id
        AND re.player_id<=>state.player_id AND re.team_id<=>state.team_id
      WHERE state.tournament_id=? AND state.eliminated=0
      GROUP BY state.id,state.player_id,state.team_id,state.losses,re.seed
      ORDER BY state.losses,COALESCE(re.seed,999999),state.updated_at
    `, [tournament.id]);
    if (activeRows.length <= 1) {
      await connection.execute(`UPDATE tournaments SET status='COMPLETED',updated_at=NOW() WHERE id=?`, [tournament.id]);
      return { advanced: true, completed: true };
    }

    const participants = activeRows.map((row): Participant => ({
      playerId: row.player_id ? Number(row.player_id) : null,
      teamId: row.team_id ? Number(row.team_id) : null,
      seed: row.seed === null ? null : Number(row.seed),
      key: participantKey(row.player_id, row.team_id)
    }));
    const [roundMeta] = await connection.query<Array<RowDataPacket & {
      next_round: number;
      final_count: number;
      reset_count: number;
    }>>(`
      SELECT COALESCE(MAX(round_number),0)+1 AS next_round,
        SUM(stage='double_final') AS final_count,
        SUM(stage='double_reset') AS reset_count
      FROM tournament_rounds
      WHERE tournament_id=? AND stage LIKE 'double_%'
    `, [tournament.id]);
    const nextRound = Number(roundMeta[0]?.next_round || 1);
    const finalExists = Number(roundMeta[0]?.final_count || 0) > 0;
    const resetExists = Number(roundMeta[0]?.reset_count || 0) > 0;

    if (participants.length === 2) {
      if (resetExists) throw new Error("DOUBLE_ELIMINATION_STATE_INVALID");
      await createDoubleEliminationRound(
        connection,
        tournament,
        participants,
        nextRound,
        finalExists ? "double_reset" : "double_final"
      );
      return { advanced: true, completed: false };
    }

    const winnerBracket = participants.filter((participant) => {
      const state = activeRows.find((row) => participantKey(row.player_id, row.team_id) === participant.key);
      return Number(state?.losses || 0) === 0;
    });
    const loserBracket = participants.filter((participant) => {
      const state = activeRows.find((row) => participantKey(row.player_id, row.team_id) === participant.key);
      return Number(state?.losses || 0) === 1;
    });
    let created = 0;
    if (winnerBracket.length >= 2) {
      await createDoubleEliminationRound(
        connection,
        tournament,
        winnerBracket,
        nextRound,
        "double_winners"
      );
      created += 1;
    }
    if (loserBracket.length >= 2) {
      await createDoubleEliminationRound(
        connection,
        tournament,
        loserBracket,
        nextRound,
        "double_losers"
      );
      created += 1;
    }
    if (!created) throw new Error("DOUBLE_ELIMINATION_STATE_INVALID");
    return { advanced: true, completed: false };
  }

  const [lastRoundRows] = await connection.query<Array<RowDataPacket & {
    id: number;
    round_number: number;
  }>>(`
    SELECT id,round_number
    FROM tournament_rounds
    WHERE tournament_id=? AND stage='knockout'
    ORDER BY round_number DESC
    LIMIT 1
  `, [tournament.id]);
  const lastRound = lastRoundRows[0];
  if (!lastRound) return { advanced: false };

  const resolved = await resolveKnockoutRound(connection, lastRound.id);
  if (resolved.winners.length <= 1) {
    await connection.execute(`UPDATE tournaments SET status='COMPLETED',updated_at=NOW() WHERE id=?`, [tournament.id]);
    return { advanced: true, completed: true };
  }

  const nextRoundNumber = Number(lastRound.round_number) + 1;
  if (resolved.winners.length === 2 && tournament.has_third_place && resolved.losers.length >= 2) {
    await createKnockoutRound(
      connection,
      tournament,
      resolved.losers.slice(0, 2),
      nextRoundNumber,
      "رده‌بندی سوم",
      "third_place",
      true
    );
  }
  await createKnockoutRound(
    connection,
    tournament,
    resolved.winners,
    nextRoundNumber,
    resolved.winners.length === 2 ? "فینال" : `دور ${nextRoundNumber}`
  );
  return { advanced: true, completed: false };
}

export async function scheduleTournamentMatches(tournamentId: number) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tournament = await loadTournament(connection, tournamentId);
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (!tournament.venue_id) throw new Error("TOURNAMENT_VENUE_REQUIRED");

    const settings = parseObject(tournament.game_settings);
    const duration = Math.round(safeNumber(
      settings.matchDurationMin ?? settings.durationMin,
      30,
      5,
      240
    ));
    const requiredType = String(
      settings.resourceType || (tournament.game_slug.includes("back") ? "table" : "ps5")
    ).toLowerCase();
    const [resourceRows] = await connection.query<Array<RowDataPacket & { id: number; type: string }>>(`
      SELECT id,type
      FROM resources
      WHERE venue_id=? AND is_active=1 AND status='available'
      ORDER BY id
      FOR UPDATE
    `, [tournament.venue_id]);
    const compatible = resourceRows.filter((row) => String(row.type).toLowerCase().includes(requiredType));
    const resources = compatible.length ? compatible : resourceRows;
    if (!resources.length) throw new Error("NO_RESOURCES");

    const [matches] = await connection.query<Array<RowDataPacket & {
      id: number;
      round_number: number;
      stage: string;
      match_number: number;
    }>>(`
      SELECT m.id,COALESCE(r.round_number,1) AS round_number,
             COALESCE(r.stage,'round') AS stage,m.match_number
      FROM tournament_matches m
      LEFT JOIN tournament_rounds r ON r.id=m.round_id
      WHERE m.tournament_id=?
        AND m.status IN ('PENDING','READY')
        AND m.scheduled_at IS NULL
      ORDER BY COALESCE(r.round_number,1),COALESCE(r.stage,'round'),m.match_number
      FOR UPDATE
    `, [tournament.id]);

    if (!matches.length) {
      await connection.commit();
      return { scheduled: 0, resources: resources.length, duration };
    }

    const matchIds = matches.map((match) => Number(match.id));
    const placeholders = matchIds.map(() => "?").join(",");
    const [participantRows] = await connection.query<Array<RowDataPacket & {
      match_id: number;
      player_id: number | null;
      team_id: number | null;
    }>>(`
      SELECT match_id,player_id,team_id
      FROM match_participants
      WHERE match_id IN (${placeholders})
    `, matchIds);
    const matchParticipants = new Map<number, Set<string>>();
    for (const participant of participantRows) {
      const keys = matchParticipants.get(Number(participant.match_id)) || new Set<string>();
      keys.add(participantKey(participant.player_id, participant.team_id));
      matchParticipants.set(Number(participant.match_id), keys);
    }

    const [existingRows] = await connection.query<Array<RowDataPacket & {
      id: number;
      resource_id: number | null;
      scheduled_at: Date;
      duration_min: number | null;
      player_id: number | null;
      team_id: number | null;
    }>>(`
      SELECT m.id,m.resource_id,m.scheduled_at,m.duration_min,mp.player_id,mp.team_id
      FROM tournament_matches m
      JOIN tournaments t ON t.id=m.tournament_id
      LEFT JOIN match_participants mp ON mp.match_id=m.id
      WHERE t.venue_id=?
        AND m.status NOT IN ('CANCELLED','COMPLETED')
        AND m.scheduled_at IS NOT NULL
    `, [tournament.venue_id]);

    type BusyWindow = { start: number; end: number };
    const resourceBusy = new Map<number, BusyWindow[]>();
    const participantBusy = new Map<string, BusyWindow[]>();
    for (const row of existingRows) {
      const startAt = new Date(row.scheduled_at).getTime();
      const endAt = startAt + Number(row.duration_min || duration) * 60_000;
      if (row.resource_id) {
        const list = resourceBusy.get(Number(row.resource_id)) || [];
        list.push({ start: startAt, end: endAt });
        resourceBusy.set(Number(row.resource_id), list);
      }
      if (row.player_id || row.team_id) {
        const key = participantKey(row.player_id, row.team_id);
        const list = participantBusy.get(key) || [];
        list.push({ start: startAt, end: endAt });
        participantBusy.set(key, list);
      }
    }

    const overlaps = (windows: BusyWindow[] | undefined, startAt: number, endAt: number) =>
      Boolean(windows?.some((window) => window.start < endAt && window.end > startAt));

    let currentRoundKey = "";
    let roundStart = Math.max(new Date(tournament.starts_at).getTime(), Date.now());
    let roundEnd = roundStart;
    for (const match of matches) {
      const isGroup = String(match.stage).startsWith("group_");
      const roundKey = isGroup
        ? `groups:${match.round_number}`
        : `${match.stage}:${match.round_number}`;
      if (roundKey !== currentRoundKey) {
        if (currentRoundKey) roundStart = Math.max(roundStart + duration * 60_000, roundEnd);
        currentRoundKey = roundKey;
        roundEnd = roundStart;
      }

      const participantKeys = matchParticipants.get(Number(match.id)) || new Set<string>();
      let candidateStart = roundStart;
      let selectedResource: number | null = null;
      for (let attempt = 0; attempt < 10_000 && selectedResource === null; attempt += 1) {
        const candidateEnd = candidateStart + duration * 60_000;
        const participantsAvailable = [...participantKeys].every(
          (key) => !overlaps(participantBusy.get(key), candidateStart, candidateEnd)
        );
        if (participantsAvailable) {
          const resource = resources.find(
            (item) => !overlaps(resourceBusy.get(Number(item.id)), candidateStart, candidateEnd)
          );
          if (resource) selectedResource = Number(resource.id);
        }
        if (selectedResource === null) candidateStart += duration * 60_000;
      }
      if (selectedResource === null) throw new Error("SCHEDULE_SLOT_NOT_FOUND");

      const candidateEnd = candidateStart + duration * 60_000;
      await connection.execute(`
        UPDATE tournament_matches
        SET resource_id=?,scheduled_at=?,duration_min=?,status='READY'
        WHERE id=?
      `, [selectedResource, new Date(candidateStart), duration, match.id]);

      const resourceWindows = resourceBusy.get(selectedResource) || [];
      resourceWindows.push({ start: candidateStart, end: candidateEnd });
      resourceBusy.set(selectedResource, resourceWindows);
      for (const key of participantKeys) {
        const windows = participantBusy.get(key) || [];
        windows.push({ start: candidateStart, end: candidateEnd });
        participantBusy.set(key, windows);
      }
      roundEnd = Math.max(roundEnd, candidateEnd);
    }

    await connection.commit();
    return { scheduled: matches.length, resources: resources.length, duration };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function boardDateCondition(periodType: string, periodKey: string) {
  if (periodType === "monthly" && /^\d{4}-\d{2}$/.test(periodKey)) {
    return { sql: "AND DATE_FORMAT(m.completed_at,'%Y-%m')=?", params: [periodKey] };
  }
  if (periodType === "yearly" && /^\d{4}$/.test(periodKey)) {
    return { sql: "AND YEAR(m.completed_at)=?", params: [Number(periodKey)] };
  }
  return { sql: "", params: [] as Array<string | number> };
}

export async function recalculateRankingsForTournament(
  connection: PoolConnection,
  tournamentId: number
) {
  const [tournamentRows] = await connection.query<Array<RowDataPacket & {
    game_id: number;
    scoring_settings: unknown;
  }>>(`SELECT game_id,scoring_settings FROM tournaments WHERE id=? LIMIT 1`, [tournamentId]);
  const tournament = tournamentRows[0];
  if (!tournament) return { boards: 0 };

  const tournamentScoring = parseObject(tournament.scoring_settings);
  const [boards] = await connection.query<Array<RowDataPacket & {
    id: number;
    formula: unknown;
    period_type: string;
    period_key: string;
  }>>(`
    SELECT id,formula,period_type,period_key
    FROM ranking_boards
    WHERE game_id=? AND is_active=1
  `, [tournament.game_id]);

  for (const board of boards) {
    const formula = { ...tournamentScoring, ...parseObject(board.formula) };
    const winPoints = safeNumber(formula.win, 3, -1000, 1000);
    const drawPoints = safeNumber(formula.draw, 1, -1000, 1000);
    const lossPoints = safeNumber(formula.loss, 0, -1000, 1000);
    const period = boardDateCondition(board.period_type, board.period_key);

    const [oldRows] = await connection.query<Array<RowDataPacket & { player_id: number; adjustment: number }>>(`
      SELECT player_id,adjustment
      FROM ranking_entries
      WHERE board_id=?
      ORDER BY (points+adjustment) DESC,wins DESC,(scored-conceded) DESC,played ASC
    `, [board.id]);
    const previousRanks = new Map(oldRows.map((row, index) => [Number(row.player_id), index + 1]));
    const adjustments = new Map(oldRows.map((row) => [Number(row.player_id), Number(row.adjustment || 0)]));

    const [matchRows] = await connection.query<Array<RowDataPacket & {
      id: number;
      home_score: number;
      away_score: number;
    }>>(`
      SELECT m.id,m.home_score,m.away_score
      FROM tournament_matches m
      JOIN tournaments t ON t.id=m.tournament_id
      WHERE t.game_id=?
        AND m.status='COMPLETED'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
        ${period.sql}
    `, [tournament.game_id, ...period.params]);

    const stats = new Map<number, {
      played: number;
      wins: number;
      draws: number;
      losses: number;
      scored: number;
      conceded: number;
      points: number;
    }>();

    for (const match of matchRows) {
      const [participants] = await connection.query<Array<RowDataPacket & {
        slot: number;
        player_id: number | null;
        team_id: number | null;
      }>>(`SELECT slot,player_id,team_id FROM match_participants WHERE match_id=?`, [match.id]);

      for (const participant of participants) {
        let playerIds: number[] = [];
        if (participant.player_id) {
          playerIds = [Number(participant.player_id)];
        } else if (participant.team_id) {
          const [members] = await connection.query<Array<RowDataPacket & { player_id: number }>>(`
            SELECT player_id FROM team_members WHERE team_id=?
          `, [participant.team_id]);
          playerIds = members.map((member) => Number(member.player_id));
        }

        const scored = participant.slot === 1 ? Number(match.home_score) : Number(match.away_score);
        const conceded = participant.slot === 1 ? Number(match.away_score) : Number(match.home_score);
        for (const playerId of playerIds) {
          const current = stats.get(playerId) || {
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
          stats.set(playerId, current);
        }
      }
    }

    await connection.execute(`DELETE FROM ranking_entries WHERE board_id=?`, [board.id]);
    for (const [playerId, statsRow] of stats) {
      await connection.execute(`
        INSERT INTO ranking_entries(
          board_id,player_id,points,wins,draws,losses,played,scored,conceded,adjustment,metadata,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW())
      `, [
        board.id,
        playerId,
        statsRow.points,
        statsRow.wins,
        statsRow.draws,
        statsRow.losses,
        statsRow.played,
        statsRow.scored,
        statsRow.conceded,
        adjustments.get(playerId) || 0,
        JSON.stringify({ previousRank: previousRanks.get(playerId) || null })
      ]);
    }
  }

  return { boards: boards.length };
}
