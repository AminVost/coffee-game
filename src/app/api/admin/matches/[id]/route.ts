import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { hasPermission } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMatchResultRules } from "@/lib/match-rules";
import { advanceTournament, recalculateRankingsForTournament } from "@/lib/tournament-engine";

const nullableId = z.coerce.number().int().positive().nullable().optional();
const nullableDateTime = z.string().datetime().nullable().optional();
const score = z.coerce.number().int().min(0).max(999);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setup"),
    resourceId: nullableId,
    refereeUserId: nullableId,
    scheduledAt: nullableDateTime,
    durationMin: z.coerce.number().int().min(5).max(240),
    notes: z.string().trim().max(1000).nullable().optional()
  }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("ready") }),
  z.object({
    action: z.literal("score"),
    homeScore: score,
    awayScore: score,
    notes: z.string().trim().max(1000).nullable().optional()
  }),
  z.object({
    action: z.literal("complete"),
    homeScore: score,
    awayScore: score,
    notes: z.string().trim().max(1000).nullable().optional()
  }),
  z.object({
    action: z.literal("postpone"),
    reason: z.string().trim().min(3).max(1000)
  }),
  z.object({
    action: z.literal("correct"),
    homeScore: score,
    awayScore: score,
    reason: z.string().trim().min(3).max(1000)
  })
]);

type MatchRow = RowDataPacket & {
  id: number;
  tournament_id: number;
  round_id: number | null;
  round_number: number | null;
  round_stage: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner_slot: number | null;
  referee_user_id: number | null;
  resource_id: number | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_min: number | null;
  format: string;
  game_settings: unknown;
  venue_id: number | null;
  tournament_status: string;
};

type ParticipantRow = RowDataPacket & {
  id: number;
  slot: number;
  player_id: number | null;
  team_id: number | null;
};

type LaterMatchRow = RowDataPacket & {
  id: number;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
};

function participantKey(participant: Pick<ParticipantRow, "player_id" | "team_id"> | undefined) {
  if (!participant) return "";
  if (participant.player_id) return `p:${participant.player_id}`;
  if (participant.team_id) return `t:${participant.team_id}`;
  return "";
}

function winnerSlot(homeScore: number, awayScore: number) {
  if (homeScore === awayScore) return null;
  return homeScore > awayScore ? 1 : 2;
}

async function hasOpenDispute(connection: Awaited<ReturnType<typeof db.getConnection>>, matchId: number) {
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT id FROM match_disputes WHERE match_id=? AND status='open' LIMIT 1
  `, [matchId]);
  return Boolean(rows[0]);
}

function validateResult(
  format: string,
  settings: unknown,
  homeScore: number,
  awayScore: number,
  finalResult: boolean
) {
  const rules = getMatchResultRules(format, settings);
  if (homeScore > rules.maxScore || awayScore > rules.maxScore) {
    throw new Error(`SCORE_OVER_MAX:${rules.maxScore}`);
  }
  if (finalResult && homeScore === awayScore && !rules.allowDraw) {
    throw new Error("DRAW_NOT_ALLOWED");
  }
  if (
    finalResult
    && rules.targetScore
    && Math.max(homeScore, awayScore) < rules.targetScore
  ) {
    throw new Error(`TARGET_SCORE_NOT_REACHED:${rules.targetScore}`);
  }
  return { rules, winner: finalResult ? winnerSlot(homeScore, awayScore) : null };
}

async function updateWinnerFlags(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  matchId: number,
  slot: number | null
) {
  await connection.execute(`UPDATE match_participants SET is_winner=0 WHERE match_id=?`, [matchId]);
  if (slot) {
    await connection.execute(`
      UPDATE match_participants SET is_winner=1 WHERE match_id=? AND slot=?
    `, [matchId, slot]);
  }
}

async function propagateKnockoutCorrection(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  match: MatchRow,
  participants: ParticipantRow[],
  newWinnerSlot: number | null
) {
  if (!match.round_id || !match.round_number || !match.winner_slot || !newWinnerSlot) return;
  if (match.winner_slot === newWinnerSlot) return;

  const [laterMatches] = await connection.query<LaterMatchRow[]>(`
    SELECT next_match.id,next_match.status,next_match.started_at,next_match.completed_at
    FROM tournament_matches next_match
    JOIN tournament_rounds next_round ON next_round.id=next_match.round_id
    WHERE next_match.tournament_id=? AND next_round.round_number>?
    FOR UPDATE
  `, [match.tournament_id, match.round_number]);

  if (laterMatches.some((item) => item.started_at || item.completed_at || ["LIVE", "COMPLETED"].includes(item.status))) {
    throw new Error("DEPENDENT_MATCH_ALREADY_STARTED");
  }
  if (!laterMatches.length) return;

  const normalizedFormat = match.format.toLowerCase();
  const isTwoLeg = normalizedFormat.includes("رفت‌وبرگشت")
    || normalizedFormat.includes("رفت و برگشت")
    || normalizedFormat.includes("two leg")
    || normalizedFormat.includes("home and away");
  if (isTwoLeg) throw new Error("DEPENDENT_ROUND_ALREADY_CREATED");

  const oldWinner = participants.find((item) => item.slot === match.winner_slot);
  const oldLoser = participants.find((item) => item.slot !== match.winner_slot);
  const newWinner = participants.find((item) => item.slot === newWinnerSlot);
  const newLoser = participants.find((item) => item.slot !== newWinnerSlot);
  const oldWinnerKey = participantKey(oldWinner);
  const oldLoserKey = participantKey(oldLoser);
  if (!oldWinnerKey || !oldLoserKey || !newWinner || !newLoser) return;

  const laterIds = laterMatches.map((item) => item.id);
  const placeholders = laterIds.map(() => "?").join(",");
  const [laterParticipants] = await connection.query<ParticipantRow[]>(`
    SELECT id,slot,player_id,team_id
    FROM match_participants
    WHERE match_id IN (${placeholders})
    FOR UPDATE
  `, laterIds);

  for (const participant of laterParticipants) {
    const key = participantKey(participant);
    const replacement = key === oldWinnerKey
      ? newWinner
      : key === oldLoserKey
        ? newLoser
        : null;
    if (!replacement) continue;
    await connection.execute(`
      UPDATE match_participants SET player_id=?,team_id=?,is_winner=0 WHERE id=?
    `, [replacement.player_id, replacement.team_id, participant.id]);
  }
}

async function ensureCorrectionIsSafe(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  match: MatchRow,
  participants: ParticipantRow[],
  newWinnerSlot: number | null
) {
  const rules = getMatchResultRules(match.format, match.game_settings);
  if (rules.category === "league") return;

  if (rules.category === "group") {
    const [knockout] = await connection.query<RowDataPacket[]>(`
      SELECT match_row.id
      FROM tournament_matches match_row
      JOIN tournament_rounds round_row ON round_row.id=match_row.round_id
      WHERE match_row.tournament_id=? AND round_row.stage IN ('knockout','third_place')
      LIMIT 1
    `, [match.tournament_id]);
    if (knockout[0]) throw new Error("DEPENDENT_ROUND_ALREADY_CREATED");
    return;
  }

  if (rules.category === "swiss" || rules.category === "double") {
    if (!match.round_number) return;
    const [later] = await connection.query<RowDataPacket[]>(`
      SELECT next_match.id
      FROM tournament_matches next_match
      JOIN tournament_rounds next_round ON next_round.id=next_match.round_id
      WHERE next_match.tournament_id=? AND next_round.round_number>?
      LIMIT 1
    `, [match.tournament_id, match.round_number]);
    if (later[0]) throw new Error("DEPENDENT_ROUND_ALREADY_CREATED");
    return;
  }

  await propagateKnockoutCorrection(connection, match, participants, newWinnerSlot);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("results.submit");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ message: "شناسه بازی نامعتبر است." }, { status: 400 });
    }

    const canManageAll = hasPermission(auth.user, "matches.manage");
    const connection = await db.getConnection();
    let match: MatchRow | null = null;
    let resultWinner: number | null = null;
    let advancement: unknown = null;

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<MatchRow[]>(`
        SELECT match_row.id,match_row.tournament_id,match_row.round_id,round_row.round_number,
               round_row.stage AS round_stage,match_row.status,match_row.home_score,match_row.away_score,
               match_row.winner_slot,match_row.referee_user_id,match_row.resource_id,match_row.scheduled_at,
               match_row.started_at,match_row.completed_at,match_row.duration_min,
               tournament.format,tournament.game_settings,tournament.venue_id,
               tournament.status AS tournament_status
        FROM tournament_matches match_row
        JOIN tournaments tournament ON tournament.id=match_row.tournament_id
        LEFT JOIN tournament_rounds round_row ON round_row.id=match_row.round_id
        WHERE match_row.id=?
        LIMIT 1
        FOR UPDATE
      `, [id]);
      match = rows[0] || null;
      if (!match) {
        await connection.rollback();
        return NextResponse.json({ message: "بازی یافت نشد." }, { status: 404 });
      }
      if (!canManageAll && String(match.referee_user_id || "") !== auth.user.id) {
        await connection.rollback();
        return NextResponse.json({ message: "این بازی به شما تخصیص داده نشده است." }, { status: 403 });
      }

      const [participants] = await connection.query<ParticipantRow[]>(`
        SELECT id,slot,player_id,team_id
        FROM match_participants
        WHERE match_id=?
        ORDER BY slot
        FOR UPDATE
      `, [id]);
      const hasTwoParticipants = participants.filter((item) => participantKey(item)).length === 2;
      const openDispute = await hasOpenDispute(connection, match.id);

      if (input.action === "setup") {
        if (!canManageAll) throw new Error("MANAGER_ONLY_ACTION");
        if (!["PENDING", "READY", "POSTPONED"].includes(match.status)) {
          throw new Error("MATCH_SETUP_LOCKED");
        }
        const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
        const resourceId = input.resourceId || null;
        const refereeUserId = input.refereeUserId || null;

        if (resourceId) {
          const [resources] = await connection.query<RowDataPacket[]>(`
            SELECT resource.id
            FROM resources resource
            WHERE resource.id=? AND resource.is_active=1 AND resource.status='available'
              AND (? IS NULL OR resource.venue_id=?)
            LIMIT 1
          `, [resourceId, match.venue_id, match.venue_id]);
          if (!resources[0]) throw new Error("INVALID_RESOURCE");
        }

        if (scheduledAt && resourceId) {
          const [resourceConflict] = await connection.query<RowDataPacket[]>(`
            SELECT id FROM tournament_matches
            WHERE id<>? AND resource_id=? AND status NOT IN ('CANCELLED','COMPLETED')
              AND scheduled_at IS NOT NULL
              AND scheduled_at < DATE_ADD(?,INTERVAL ? MINUTE)
              AND DATE_ADD(scheduled_at,INTERVAL COALESCE(duration_min,30) MINUTE) > ?
            LIMIT 1
          `, [id, resourceId, scheduledAt, input.durationMin, scheduledAt]);
          if (resourceConflict[0]) throw new Error("RESOURCE_CONFLICT");
        }
        if (scheduledAt && refereeUserId) {
          const [refereeConflict] = await connection.query<RowDataPacket[]>(`
            SELECT id FROM tournament_matches
            WHERE id<>? AND referee_user_id=? AND status NOT IN ('CANCELLED','COMPLETED')
              AND scheduled_at IS NOT NULL
              AND scheduled_at < DATE_ADD(?,INTERVAL ? MINUTE)
              AND DATE_ADD(scheduled_at,INTERVAL COALESCE(duration_min,30) MINUTE) > ?
            LIMIT 1
          `, [id, refereeUserId, scheduledAt, input.durationMin, scheduledAt]);
          if (refereeConflict[0]) throw new Error("REFEREE_CONFLICT");
        }
        if (scheduledAt) {
          const [participantConflict] = await connection.query<RowDataPacket[]>(`
            SELECT other.id
            FROM match_participants current_participant
            JOIN match_participants other_participant
              ON (other_participant.player_id<=>current_participant.player_id)
             AND (other_participant.team_id<=>current_participant.team_id)
            JOIN tournament_matches other ON other.id=other_participant.match_id
            WHERE current_participant.match_id=? AND other.id<>?
              AND other.status NOT IN ('CANCELLED','COMPLETED')
              AND other.scheduled_at IS NOT NULL
              AND other.scheduled_at < DATE_ADD(?,INTERVAL ? MINUTE)
              AND DATE_ADD(other.scheduled_at,INTERVAL COALESCE(other.duration_min,30) MINUTE) > ?
            LIMIT 1
          `, [id, id, scheduledAt, input.durationMin, scheduledAt]);
          if (participantConflict[0]) throw new Error("PARTICIPANT_CONFLICT");
        }

        const nextStatus = hasTwoParticipants && scheduledAt && resourceId ? "READY" : "PENDING";
        await connection.execute(`
          UPDATE tournament_matches
          SET resource_id=?,referee_user_id=?,scheduled_at=?,duration_min=?,notes=?,status=?
          WHERE id=?
        `, [resourceId, refereeUserId, scheduledAt, input.durationMin, input.notes || null, nextStatus, id]);
      }

      if (input.action === "start") {
        if (!["READY", "POSTPONED"].includes(match.status)) throw new Error("MATCH_CANNOT_START");
        if (!hasTwoParticipants) throw new Error("MATCH_PARTICIPANTS_INCOMPLETE");
        if (!match.scheduled_at || !match.resource_id) throw new Error("MATCH_SETUP_INCOMPLETE");
        if (openDispute) throw new Error("OPEN_DISPUTE_EXISTS");
        await connection.execute(`
          UPDATE tournament_matches
          SET status='LIVE',started_at=COALESCE(started_at,NOW()),completed_at=NULL
          WHERE id=?
        `, [id]);
        await connection.execute(`
          UPDATE tournaments SET status='RUNNING',updated_at=NOW()
          WHERE id=? AND status NOT IN ('COMPLETED','CANCELLED')
        `, [match.tournament_id]);
      }

      if (input.action === "ready") {
        if (match.status !== "POSTPONED") throw new Error("MATCH_CANNOT_BE_READY");
        if (!hasTwoParticipants) throw new Error("MATCH_PARTICIPANTS_INCOMPLETE");
        if (!match.scheduled_at || !match.resource_id) throw new Error("MATCH_SETUP_INCOMPLETE");
        if (openDispute) throw new Error("OPEN_DISPUTE_EXISTS");
        await connection.execute(`UPDATE tournament_matches SET status='READY' WHERE id=?`, [id]);
      }

      if (input.action === "score") {
        if (match.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");
        validateResult(match.format, match.game_settings, input.homeScore, input.awayScore, false);
        await connection.execute(`
          UPDATE tournament_matches SET home_score=?,away_score=?,notes=? WHERE id=?
        `, [input.homeScore, input.awayScore, input.notes || null, id]);
      }

      if (input.action === "complete") {
        if (match.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");
        if (!hasTwoParticipants) throw new Error("MATCH_PARTICIPANTS_INCOMPLETE");
        if (openDispute) throw new Error("OPEN_DISPUTE_EXISTS");
        const result = validateResult(match.format, match.game_settings, input.homeScore, input.awayScore, true);
        resultWinner = result.winner;
        await connection.execute(`
          UPDATE tournament_matches
          SET home_score=?,away_score=?,status='COMPLETED',winner_slot=?,notes=?,completed_at=NOW()
          WHERE id=?
        `, [input.homeScore, input.awayScore, resultWinner, input.notes || null, id]);
        await updateWinnerFlags(connection, match.id, resultWinner);
        advancement = await advanceTournament(connection, match.tournament_id);
        await recalculateRankingsForTournament(connection, match.tournament_id);
      }

      if (input.action === "postpone") {
        if (!["READY", "LIVE"].includes(match.status)) throw new Error("MATCH_CANNOT_BE_POSTPONED");
        await connection.execute(`
          UPDATE tournament_matches SET status='POSTPONED',notes=? WHERE id=?
        `, [input.reason, id]);
      }

      if (input.action === "correct") {
        if (!canManageAll) throw new Error("MANAGER_ONLY_ACTION");
        if (match.status !== "COMPLETED") throw new Error("MATCH_NOT_COMPLETED");
        if (!hasTwoParticipants) throw new Error("AUTOMATIC_BYE_RESULT");
        if (openDispute) throw new Error("OPEN_DISPUTE_EXISTS");
        const result = validateResult(match.format, match.game_settings, input.homeScore, input.awayScore, true);
        resultWinner = result.winner;
        await ensureCorrectionIsSafe(connection, match, participants, resultWinner);
        await connection.execute(`
          UPDATE tournament_matches
          SET home_score=?,away_score=?,winner_slot=?,notes=?
          WHERE id=?
        `, [input.homeScore, input.awayScore, resultWinner, input.reason, id]);
        await updateWinnerFlags(connection, match.id, resultWinner);
        await connection.execute(`
          UPDATE match_disputes
          SET status='resolved',
              resolution=CONCAT(COALESCE(resolution,''),'\nنتیجه نهایی توسط مدیر اصلاح شد.'),
              resolved_by=?,resolved_at=NOW()
          WHERE match_id=? AND status='accepted'
        `, [auth.user.id, match.id]);
        advancement = await advanceTournament(connection, match.tournament_id);
        await recalculateRankingsForTournament(connection, match.tournament_id);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: `match.${input.action}`,
      entityType: "tournament_match",
      entityId: id,
      oldData: match ? {
        status: match.status,
        homeScore: match.home_score,
        awayScore: match.away_score,
        winnerSlot: match.winner_slot
      } : undefined,
      newData: input,
      request
    });
    return NextResponse.json({ ok: true, action: input.action, winnerSlot: resultWinner, advancement });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "اطلاعات بازی نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("SCORE_OVER_MAX:")) {
      return NextResponse.json({ message: `امتیاز نمی‌تواند بیشتر از ${Number(code.split(":")[1]).toLocaleString("fa-IR")} باشد.` }, { status: 422 });
    }
    if (code.startsWith("TARGET_SCORE_NOT_REACHED:")) {
      return NextResponse.json({ message: `برای پایان بازی، یکی از طرفین باید حداقل به امتیاز ${Number(code.split(":")[1]).toLocaleString("fa-IR")} برسد.` }, { status: 422 });
    }
    const messages: Record<string, string> = {
      MANAGER_ONLY_ACTION: "این عملیات فقط توسط مدیر مسابقات قابل انجام است.",
      MATCH_SETUP_LOCKED: "پس از شروع یا پایان بازی، تنظیمات زمان‌بندی قابل تغییر نیست.",
      MATCH_CANNOT_START: "فقط بازی آماده یا به‌تعویق‌افتاده قابل شروع است.",
      MATCH_CANNOT_BE_READY: "فقط بازی به‌تعویق‌افتاده را می‌توان به حالت آماده بازگرداند.",
      MATCH_NOT_LIVE: "برای ثبت امتیاز یا پایان بازی، ابتدا بازی را شروع کنید.",
      MATCH_NOT_COMPLETED: "فقط نتیجه بازی پایان‌یافته قابل اصلاح است.",
      MATCH_CANNOT_BE_POSTPONED: "فقط بازی آماده یا در حال برگزاری قابل تعویق است.",
      MATCH_PARTICIPANTS_INCOMPLETE: "هر دو شرکت‌کننده بازی باید مشخص باشند.",
      MATCH_SETUP_INCOMPLETE: "قبل از شروع، زمان و میز یا دستگاه بازی را مشخص کنید.",
      OPEN_DISPUTE_EXISTS: "ابتدا اعتراض باز این بازی را تعیین تکلیف کنید.",
      DRAW_NOT_ALLOWED: "این مسابقه با نتیجه مساوی قابل پایان نیست.",
      AUTOMATIC_BYE_RESULT: "نتیجه بازی Bye خودکار قابل ویرایش نیست.",
      DEPENDENT_MATCH_ALREADY_STARTED: "بازی وابسته مرحله بعد شروع شده و تغییر برنده این بازی امن نیست.",
      DEPENDENT_ROUND_ALREADY_CREATED: "مرحله بعد بر اساس این نتیجه ساخته شده و نتیجه دیگر قابل اصلاح نیست.",
      INVALID_RESOURCE: "میز یا دستگاه انتخاب‌شده فعال یا متعلق به محل مسابقه نیست.",
      RESOURCE_CONFLICT: "میز یا دستگاه انتخاب‌شده در این بازه مشغول است.",
      REFEREE_CONFLICT: "داور انتخاب‌شده در این بازه بازی دیگری دارد.",
      PARTICIPANT_CONFLICT: "یکی از شرکت‌کنندگان در این بازه بازی دیگری دارد.",
      AGGREGATE_TIE: "مجموع نتیجه رفت‌وبرگشت مساوی است و باید نتیجه تعیین‌کننده ثبت شود."
    };
    return NextResponse.json(
      { message: messages[code] || "ذخیره اطلاعات بازی انجام نشد." },
      { status: messages[code] ? 409 : 500 }
    );
  }
}
