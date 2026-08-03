import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getRequiredResourceType } from "@/lib/resource-type";

type ScheduleInput = {
  mode: "preview" | "apply";
  startAt: Date;
  durationMin: number;
  roundBreakMin: number;
  participantRestMin: number;
  assignReferees: boolean;
};

type BusyWindow = { start: number; end: number };

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  status: string;
  starts_at: Date;
  ends_at: Date | null;
  venue_id: number | null;
  venue_title: string | null;
  game_slug: string;
  game_title: string;
  game_settings: unknown;
};

type ResourceRow = RowDataPacket & {
  id: number;
  title: string;
  type: string;
};

type RefereeRow = RowDataPacket & {
  id: number;
  name: string;
};

type MatchRow = RowDataPacket & {
  id: number;
  match_number: number;
  status: string;
  scheduled_at: Date | null;
  duration_min: number | null;
  referee_user_id: number | null;
  round_number: number;
  stage: string;
  round_title: string;
  home_name: string | null;
  away_name: string | null;
};

type ParticipantRow = RowDataPacket & {
  match_id: number;
  player_id: number | null;
  team_id: number | null;
};

type ExistingWindowRow = RowDataPacket & {
  id: number;
  resource_id: number | null;
  referee_user_id: number | null;
  scheduled_at: Date;
  duration_min: number | null;
  player_id: number | null;
  team_id: number | null;
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

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function participantKey(playerId: number | null, teamId: number | null) {
  return playerId ? `p:${playerId}` : `t:${teamId}`;
}

function defaultDuration(tournament: TournamentRow) {
  const settings = parseObject(tournament.game_settings);
  return safeNumber(settings.matchDurationMin ?? settings.durationMin, 30, 5, 240);
}

function overlaps(windows: BusyWindow[] | undefined, start: number, end: number) {
  return Boolean(windows?.some((window) => window.start < end && window.end > start));
}

async function loadTournament(connection: Awaited<ReturnType<typeof db.getConnection>>, tournamentId: number, lock = false) {
  const [rows] = await connection.query<TournamentRow[]>(`
    SELECT t.id,t.title,t.status,t.starts_at,t.ends_at,t.venue_id,
           venue.title AS venue_title,g.slug AS game_slug,g.title AS game_title,t.game_settings
    FROM tournaments t
    JOIN games g ON g.id=t.game_id
    LEFT JOIN venues venue ON venue.id=t.venue_id
    WHERE t.id=? AND t.deleted_at IS NULL
    LIMIT 1
    ${lock ? "FOR UPDATE" : ""}
  `, [tournamentId]);
  return rows[0] || null;
}

async function loadResources(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  tournament: TournamentRow,
  lock = false
) {
  if (!tournament.venue_id) return [];
  const [rows] = await connection.query<ResourceRow[]>(`
    SELECT id,title,type
    FROM resources
    WHERE venue_id=? AND is_active=1 AND status='available'
    ORDER BY title,id
    ${lock ? "FOR UPDATE" : ""}
  `, [tournament.venue_id]);
  const requiredType = getRequiredResourceType(tournament.game_slug, tournament.game_settings);
  return rows.filter((row) => String(row.type).toLowerCase() === requiredType);
}

async function loadReferees(connection: Awaited<ReturnType<typeof db.getConnection>>) {
  const [rows] = await connection.query<RefereeRow[]>(`
    SELECT DISTINCT user.id,user.name
    FROM users user
    JOIN user_roles user_role ON user_role.user_id=user.id
    JOIN roles role ON role.id=user_role.role_id
    WHERE user.status='ACTIVE'
      AND user.deleted_at IS NULL
      AND role.name IN ('referee','operator','manager','super_admin')
    ORDER BY user.name,user.id
  `);
  return rows;
}

async function loadMatches(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  tournamentId: number,
  onlyUnscheduled: boolean,
  lock = false
) {
  const [rows] = await connection.query<MatchRow[]>(`
    SELECT match_item.id,match_item.match_number,match_item.status,match_item.scheduled_at,
           match_item.duration_min,match_item.referee_user_id,
           COALESCE(round_item.round_number,1) AS round_number,
           COALESCE(round_item.stage,'round') AS stage,
           COALESCE(round_item.title,'مرحله مسابقه') AS round_title,
           COALESCE(home_team.title,home_player.name) AS home_name,
           COALESCE(away_team.title,away_player.name) AS away_name
    FROM tournament_matches match_item
    LEFT JOIN tournament_rounds round_item ON round_item.id=match_item.round_id
    LEFT JOIN match_participants home_participant
      ON home_participant.match_id=match_item.id AND home_participant.slot=1
    LEFT JOIN teams home_team ON home_team.id=home_participant.team_id
    LEFT JOIN players home_player ON home_player.id=home_participant.player_id
    LEFT JOIN match_participants away_participant
      ON away_participant.match_id=match_item.id AND away_participant.slot=2
    LEFT JOIN teams away_team ON away_team.id=away_participant.team_id
    LEFT JOIN players away_player ON away_player.id=away_participant.player_id
    WHERE match_item.tournament_id=?
      ${onlyUnscheduled ? "AND match_item.status IN ('PENDING','READY') AND match_item.scheduled_at IS NULL" : ""}
    ORDER BY COALESCE(round_item.round_number,1),COALESCE(round_item.stage,'round'),match_item.match_number
    ${lock ? "FOR UPDATE" : ""}
  `, [tournamentId]);
  return rows;
}

export async function getTournamentScheduleOverview(tournamentId: number) {
  const connection = await db.getConnection();
  try {
    const tournament = await loadTournament(connection, tournamentId);
    if (!tournament) return null;
    const [resources, referees, matches] = await Promise.all([
      loadResources(connection, tournament),
      loadReferees(connection),
      loadMatches(connection, tournamentId, false)
    ]);
    const scheduled = matches.filter((match) => Boolean(match.scheduled_at));
    const unscheduled = matches.filter(
      (match) => !match.scheduled_at && ["PENDING", "READY"].includes(match.status)
    );
    return {
      tournament: {
        id: Number(tournament.id),
        title: tournament.title,
        status: tournament.status,
        startsAt: new Date(tournament.starts_at).toISOString(),
        endsAt: tournament.ends_at ? new Date(tournament.ends_at).toISOString() : null,
        venueId: tournament.venue_id ? String(tournament.venue_id) : null,
        venue: tournament.venue_title || null,
        game: tournament.game_title,
        resourceType: getRequiredResourceType(tournament.game_slug, tournament.game_settings)
      },
      defaults: {
        durationMin: defaultDuration(tournament),
        roundBreakMin: 10,
        participantRestMin: 10,
        startAt: new Date(Math.max(new Date(tournament.starts_at).getTime(), Date.now())).toISOString()
      },
      counts: {
        total: matches.length,
        scheduled: scheduled.length,
        unscheduled: unscheduled.length,
        completed: matches.filter((match) => match.status === "COMPLETED").length
      },
      resources: resources.map((resource) => ({
        id: String(resource.id),
        title: resource.title,
        type: resource.type
      })),
      referees: referees.map((referee) => ({ id: String(referee.id), title: referee.name })),
      matches: matches.map((match) => ({
        id: String(match.id),
        matchNumber: Number(match.match_number),
        round: match.round_title,
        status: match.status,
        scheduledAt: match.scheduled_at ? new Date(match.scheduled_at).toISOString() : null,
        durationMin: match.duration_min ? Number(match.duration_min) : null,
        home: match.home_name || "در انتظار",
        away: match.away_name || "در انتظار"
      }))
    };
  } finally {
    connection.release();
  }
}

export async function planTournamentSchedule(tournamentId: number, input: ScheduleInput) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tournament = await loadTournament(connection, tournamentId, true);
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (!["DRAW_READY", "RUNNING"].includes(tournament.status)) {
      throw new Error("TOURNAMENT_NOT_READY_FOR_SCHEDULE");
    }
    if (!tournament.venue_id) throw new Error("TOURNAMENT_VENUE_REQUIRED");

    const resources = await loadResources(connection, tournament, true);
    if (!resources.length) throw new Error("NO_COMPATIBLE_RESOURCES");
    const referees = await loadReferees(connection);
    if (input.assignReferees && !referees.length) throw new Error("NO_REFEREES");

    const matches = await loadMatches(connection, tournamentId, true, true);
    if (!matches.length) {
      if (input.mode === "apply") await connection.commit();
      else await connection.rollback();
      return { scheduled: 0, plan: [], resources: resources.length, referees: referees.length };
    }

    const matchIds = matches.map((match) => Number(match.id));
    const placeholders = matchIds.map(() => "?").join(",");
    const [participantRows] = await connection.query<ParticipantRow[]>(`
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

    const [existingRows] = await connection.query<ExistingWindowRow[]>(`
      SELECT match_item.id,match_item.resource_id,match_item.referee_user_id,
             match_item.scheduled_at,match_item.duration_min,
             participant.player_id,participant.team_id
      FROM tournament_matches match_item
      LEFT JOIN match_participants participant ON participant.match_id=match_item.id
      WHERE match_item.status NOT IN ('CANCELLED','COMPLETED')
        AND match_item.scheduled_at IS NOT NULL
    `);

    const resourceBusy = new Map<number, BusyWindow[]>();
    const participantBusy = new Map<string, BusyWindow[]>();
    const refereeBusy = new Map<number, BusyWindow[]>();
    for (const row of existingRows) {
      const start = new Date(row.scheduled_at).getTime();
      const end = start + Number(row.duration_min || input.durationMin) * 60_000;
      if (row.resource_id) {
        const list = resourceBusy.get(Number(row.resource_id)) || [];
        list.push({ start, end });
        resourceBusy.set(Number(row.resource_id), list);
      }
      if (row.referee_user_id) {
        const list = refereeBusy.get(Number(row.referee_user_id)) || [];
        list.push({ start, end });
        refereeBusy.set(Number(row.referee_user_id), list);
      }
      if (row.player_id || row.team_id) {
        const key = participantKey(row.player_id, row.team_id);
        const list = participantBusy.get(key) || [];
        list.push({ start, end: end + input.participantRestMin * 60_000 });
        participantBusy.set(key, list);
      }
    }

    const tournamentStart = new Date(tournament.starts_at).getTime();
    const requestedStart = input.startAt.getTime();
    if (!Number.isFinite(requestedStart)) throw new Error("INVALID_SCHEDULE_START");
    let roundStart = Math.max(tournamentStart, requestedStart);
    const hardEnd = tournament.ends_at
      ? new Date(tournament.ends_at).getTime()
      : roundStart + 14 * 24 * 60 * 60_000;
    if (hardEnd <= roundStart) throw new Error("INVALID_TOURNAMENT_TIME_RANGE");

    let currentRoundKey = "";
    let roundEnd = roundStart;
    const plan: Array<{
      matchId: string;
      matchNumber: number;
      round: string;
      home: string;
      away: string;
      scheduledAt: string;
      durationMin: number;
      resourceId: string;
      resource: string;
      refereeUserId: string | null;
      referee: string | null;
    }> = [];

    for (const match of matches) {
      const isGroup = String(match.stage).startsWith("group_");
      const roundKey = isGroup
        ? `groups:${match.round_number}`
        : `${match.stage}:${match.round_number}`;
      if (roundKey !== currentRoundKey) {
        if (currentRoundKey) {
          roundStart = Math.max(roundEnd + input.roundBreakMin * 60_000, roundStart);
        }
        currentRoundKey = roundKey;
        roundEnd = roundStart;
      }

      const participantKeys = matchParticipants.get(Number(match.id)) || new Set<string>();
      let candidateStart = roundStart;
      let selectedResource: ResourceRow | null = null;
      let selectedReferee: RefereeRow | null = null;

      for (let attempt = 0; attempt < 20_000 && !selectedResource; attempt += 1) {
        const candidateEnd = candidateStart + input.durationMin * 60_000;
        if (candidateEnd > hardEnd) break;
        const participantsAvailable = [...participantKeys].every(
          (key) => !overlaps(participantBusy.get(key), candidateStart, candidateEnd)
        );
        if (participantsAvailable) {
          selectedResource = resources.find(
            (resource) => !overlaps(resourceBusy.get(Number(resource.id)), candidateStart, candidateEnd)
          ) || null;
          if (selectedResource) {
            if (match.referee_user_id) {
              const existingReferee = referees.find((referee) => Number(referee.id) === Number(match.referee_user_id));
              if (!existingReferee || overlaps(refereeBusy.get(Number(existingReferee.id)), candidateStart, candidateEnd)) {
                selectedResource = null;
              } else {
                selectedReferee = existingReferee;
              }
            } else if (input.assignReferees) {
              selectedReferee = referees.find(
                (referee) => !overlaps(refereeBusy.get(Number(referee.id)), candidateStart, candidateEnd)
              ) || null;
              if (!selectedReferee) selectedResource = null;
            }
          }
        }
        if (!selectedResource) candidateStart += 5 * 60_000;
      }

      if (!selectedResource) throw new Error("SCHEDULE_SLOT_NOT_FOUND");
      const candidateEnd = candidateStart + input.durationMin * 60_000;
      const resourceId = Number(selectedResource.id);
      const refereeId = selectedReferee ? Number(selectedReferee.id) : null;

      if (input.mode === "apply") {
        await connection.execute(`
          UPDATE tournament_matches
          SET resource_id=?,referee_user_id=?,scheduled_at=?,duration_min=?,status='READY'
          WHERE id=? AND scheduled_at IS NULL AND status IN ('PENDING','READY')
        `, [resourceId, refereeId, new Date(candidateStart), input.durationMin, match.id]);
      }

      const resourceWindows = resourceBusy.get(resourceId) || [];
      resourceWindows.push({ start: candidateStart, end: candidateEnd });
      resourceBusy.set(resourceId, resourceWindows);
      if (refereeId) {
        const refereeWindows = refereeBusy.get(refereeId) || [];
        refereeWindows.push({ start: candidateStart, end: candidateEnd });
        refereeBusy.set(refereeId, refereeWindows);
      }
      for (const key of participantKeys) {
        const windows = participantBusy.get(key) || [];
        windows.push({ start: candidateStart, end: candidateEnd + input.participantRestMin * 60_000 });
        participantBusy.set(key, windows);
      }

      plan.push({
        matchId: String(match.id),
        matchNumber: Number(match.match_number),
        round: match.round_title,
        home: match.home_name || "در انتظار",
        away: match.away_name || "در انتظار",
        scheduledAt: new Date(candidateStart).toISOString(),
        durationMin: input.durationMin,
        resourceId: String(resourceId),
        resource: selectedResource.title,
        refereeUserId: refereeId ? String(refereeId) : null,
        referee: selectedReferee?.name || null
      });
      roundEnd = Math.max(roundEnd, candidateEnd);
    }

    if (input.mode === "apply") await connection.commit();
    else await connection.rollback();

    return {
      scheduled: plan.length,
      plan,
      resources: resources.length,
      referees: referees.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
