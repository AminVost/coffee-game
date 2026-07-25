import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { db, queryRows } from "@/lib/db";
import {
  generateTournamentDraw,
  previewTournamentDraw,
  regenerateTournamentDraw,
  resetTournamentDraw
} from "@/lib/tournament-engine";

const participantKeySchema = z.string().regex(/^(p|t):\d+$/);
const pairingSchema = z.object({
  homeKey: participantKeySchema.nullable(),
  awayKey: participantKeySchema.nullable()
});
const actionSchema = z.object({
  action: z.enum(["preview", "generate", "regenerate"]).default("generate"),
  participantOrder: z.array(participantKeySchema).max(5000).optional(),
  pairings: z.array(pairingSchema).max(2500).optional()
});
const seedSchema = z.object({
  seeds: z.array(z.object({
    entryId: z.number().int().positive(),
    seed: z.number().int().min(1).max(5000).nullable()
  })).min(1).max(5000)
});

const messages: Record<string, string> = {
  TOURNAMENT_NOT_FOUND: "مسابقه یافت نشد.",
  TOURNAMENT_NOT_READY_FOR_DRAW: "ابتدا ثبت‌نام مسابقه را ببندید؛ قرعه فقط در وضعیت REGISTRATION_CLOSED ساخته می‌شود.",
  DRAW_ALREADY_EXISTS: "قرعه این مسابقه قبلاً ساخته شده است.",
  NOT_ENOUGH_PARTICIPANTS: "حداقل دو شرکت‌کننده تأییدشده لازم است.",
  MINIMUM_PARTICIPANTS_NOT_REACHED: "تعداد شرکت‌کنندگان تأییدشده به حداقل تعیین‌شده مسابقه نرسیده است.",
  DUPLICATE_SEED: "Seed تکراری است. هر Seed باید فقط به یک شرکت‌کننده اختصاص داده شود.",
  INVALID_SEED: "مقدار Seed نامعتبر است.",
  INVALID_PARTICIPANT_ORDER: "ترتیب شرکت‌کنندگان نامعتبر یا ناقص است.",
  MANUAL_DRAW_EMPTY: "برای قرعه دستی حداقل یک Pairing لازم است.",
  MANUAL_DRAW_EMPTY_PAIR: "یک Pairing کاملاً خالی در قرعه دستی وجود دارد.",
  MANUAL_DRAW_UNKNOWN_PARTICIPANT: "یکی از شرکت‌کنندگان قرعه دستی متعلق به این مسابقه نیست.",
  MANUAL_DRAW_DUPLICATE_PARTICIPANT: "یک شرکت‌کننده بیش از یک بار در قرعه دستی قرار گرفته است.",
  MANUAL_DRAW_MISSING_PARTICIPANT: "همه شرکت‌کنندگان باید دقیقاً یک بار در قرعه دستی قرار بگیرند.",
  DRAW_RESET_LOCKED: "پس از شروع یا تکمیل یک بازی، حذف یا قرعه مجدد مجاز نیست.",
  DRAW_HAS_DISPUTES: "برای بازی‌های این قرعه اعتراض ثبت شده و حذف قرعه مجاز نیست.",
  DOUBLE_ELIMINATION_STATE_INVALID: "وضعیت براکت دوحذفی ناسازگار است."
};

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ message: "اطلاعات قرعه نامعتبر است.", errors: error.issues }, { status: 422 });
  }
  const code = error instanceof Error ? error.message : "";
  return NextResponse.json(
    { message: messages[code] || "عملیات قرعه انجام نشد.", code: code || undefined },
    { status: code === "TOURNAMENT_NOT_FOUND" ? 404 : 409 }
  );
}

function formatCategory(format: string) {
  const normalized = format.toLowerCase();
  if (normalized.includes("گروه") || normalized.includes("group")) return "group";
  if (normalized.includes("سوئیس") || normalized.includes("swiss")) return "swiss";
  if (normalized.includes("دوحذفی") || normalized.includes("double elimination")) return "double";
  if (normalized.includes("لیگ") || normalized.includes("round robin")) return "league";
  return "knockout";
}

async function parseBody(request: Request) {
  const text = await request.text();
  return text.trim() ? JSON.parse(text) : { action: "generate" };
}

async function tournamentId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return /^\d+$/.test(id) ? Number(id) : null;
}

type TournamentInfo = RowDataPacket & {
  id: number;
  title: string;
  status: string;
  format: string;
  draw_mode: string;
  min_participants: number;
  participant_type: string;
};

type ParticipantRow = RowDataPacket & {
  entry_id: number;
  registration_id: number;
  player_id: number | null;
  team_id: number | null;
  seed: number | null;
  name: string;
  mobile: string | null;
};

type MatchRow = RowDataPacket & {
  round_id: number;
  round_title: string;
  round_number: number;
  stage: string;
  match_id: number;
  match_number: number;
  status: string;
  scheduled_at: Date | null;
  home_score: number | null;
  away_score: number | null;
  home_key: string | null;
  away_key: string | null;
  home_name: string | null;
  away_name: string | null;
  home_seed: number | null;
  away_seed: number | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("draws.manage");
  if (auth.response) return auth.response;
  const id = await tournamentId(params);
  if (!id) return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });

  const [tournamentRows, participants, matches] = await Promise.all([
    queryRows<TournamentInfo[]>(`
      SELECT id,title,status,format,draw_mode,min_participants,participant_type
      FROM tournaments WHERE id=? AND deleted_at IS NULL LIMIT 1
    `, [id]),
    queryRows<ParticipantRow[]>(`
      SELECT re.id AS entry_id,re.registration_id,re.player_id,re.team_id,re.seed,
        COALESCE(team.title,player.name,'بدون نام') AS name,
        player.mobile
      FROM registration_entries re
      JOIN registrations registration ON registration.id=re.registration_id
      LEFT JOIN players player ON player.id=re.player_id
      LEFT JOIN teams team ON team.id=re.team_id
      WHERE registration.tournament_id=?
        AND registration.deleted_at IS NULL
        AND registration.status IN ('CONFIRMED','CHECKED_IN')
      ORDER BY COALESCE(re.seed,999999),re.id
    `, [id]),
    queryRows<MatchRow[]>(`
      SELECT round.id AS round_id,round.title AS round_title,round.round_number,round.stage,
        match_row.id AS match_id,match_row.match_number,match_row.status,match_row.scheduled_at,
        match_row.home_score,match_row.away_score,
        CASE WHEN home.player_id IS NOT NULL THEN CONCAT('p:',home.player_id)
             WHEN home.team_id IS NOT NULL THEN CONCAT('t:',home.team_id) END AS home_key,
        CASE WHEN away.player_id IS NOT NULL THEN CONCAT('p:',away.player_id)
             WHEN away.team_id IS NOT NULL THEN CONCAT('t:',away.team_id) END AS away_key,
        COALESCE(home_team.title,home_player.name) AS home_name,
        COALESCE(away_team.title,away_player.name) AS away_name,
        home.seed AS home_seed,away.seed AS away_seed
      FROM tournament_rounds round
      JOIN tournament_matches match_row ON match_row.round_id=round.id
      LEFT JOIN match_participants home ON home.match_id=match_row.id AND home.slot=1
      LEFT JOIN teams home_team ON home_team.id=home.team_id
      LEFT JOIN players home_player ON home_player.id=home.player_id
      LEFT JOIN match_participants away ON away.match_id=match_row.id AND away.slot=2
      LEFT JOIN teams away_team ON away_team.id=away.team_id
      LEFT JOIN players away_player ON away_player.id=away.player_id
      WHERE round.tournament_id=?
      ORDER BY round.round_number,round.stage,match_row.match_number
    `, [id])
  ]);

  const tournament = tournamentRows[0];
  if (!tournament) return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });

  return NextResponse.json({
    tournament: {
      id: String(tournament.id),
      title: tournament.title,
      status: tournament.status,
      format: tournament.format,
      drawMode: tournament.draw_mode,
      minimumParticipants: Number(tournament.min_participants),
      participantType: tournament.participant_type,
      category: formatCategory(tournament.format)
    },
    participants: participants.map((participant) => ({
      entryId: Number(participant.entry_id),
      registrationId: Number(participant.registration_id),
      key: participant.player_id ? `p:${participant.player_id}` : `t:${participant.team_id}`,
      name: participant.name,
      mobile: participant.mobile,
      seed: participant.seed === null ? null : Number(participant.seed)
    })),
    matches: matches.map((match) => ({
      roundId: Number(match.round_id),
      roundTitle: match.round_title,
      roundNumber: Number(match.round_number),
      stage: match.stage,
      matchId: Number(match.match_id),
      matchNumber: Number(match.match_number),
      status: match.status,
      scheduledAt: match.scheduled_at ? new Date(match.scheduled_at).toISOString() : null,
      homeScore: match.home_score === null ? null : Number(match.home_score),
      awayScore: match.away_score === null ? null : Number(match.away_score),
      homeKey: match.home_key,
      awayKey: match.away_key,
      homeName: match.home_name,
      awayName: match.away_name,
      homeSeed: match.home_seed === null ? null : Number(match.home_seed),
      awaySeed: match.away_seed === null ? null : Number(match.away_seed)
    })),
    canReset: !matches.some((match) => ["LIVE", "COMPLETED"].includes(match.status)),
    drawExists: matches.length > 0
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("draws.manage");
  if (auth.response) return auth.response;
  const id = await tournamentId(params);
  if (!id) return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });

  const connection = await db.getConnection();
  try {
    const input = seedSchema.parse(await request.json());
    await connection.beginTransaction();
    const [existingDraw] = await connection.query<RowDataPacket[]>(`
      SELECT id FROM tournament_matches WHERE tournament_id=? LIMIT 1 FOR UPDATE
    `, [id]);
    if (existingDraw[0]) throw new Error("DRAW_ALREADY_EXISTS");

    const [entries] = await connection.query<Array<RowDataPacket & { id: number; seed: number | null }>>(`
      SELECT re.id,re.seed
      FROM registration_entries re
      JOIN registrations registration ON registration.id=re.registration_id
      WHERE registration.tournament_id=?
        AND registration.deleted_at IS NULL
        AND registration.status IN ('CONFIRMED','CHECKED_IN')
      FOR UPDATE
    `, [id]);
    const entryIds = new Set(entries.map((entry) => Number(entry.id)));
    if (input.seeds.some((item) => !entryIds.has(item.entryId))) {
      throw new Error("MANUAL_DRAW_UNKNOWN_PARTICIPANT");
    }

    const nextSeeds = new Map(entries.map((entry) => [Number(entry.id), entry.seed === null ? null : Number(entry.seed)]));
    input.seeds.forEach((item) => nextSeeds.set(item.entryId, item.seed));
    const values = [...nextSeeds.values()].filter((seed): seed is number => seed !== null);
    if (new Set(values).size !== values.length) throw new Error("DUPLICATE_SEED");

    for (const item of input.seeds) {
      await connection.execute<ResultSetHeader>(`
        UPDATE registration_entries SET seed=? WHERE id=?
      `, [item.seed, item.entryId]);
    }
    await connection.commit();
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.seeds_updated",
      entityType: "tournament",
      entityId: id,
      newData: input,
      request
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    return errorResponse(error);
  } finally {
    connection.release();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("draws.manage");
  if (auth.response) return auth.response;
  const id = await tournamentId(params);
  if (!id) return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });

  try {
    const input = actionSchema.parse(await parseBody(request));
    const options = { participantOrder: input.participantOrder, manualPairings: input.pairings };
    const result = input.action === "preview"
      ? await previewTournamentDraw(id, options)
      : input.action === "regenerate"
        ? await regenerateTournamentDraw(id, options)
        : await generateTournamentDraw(id, options);

    if (input.action !== "preview") {
      await writeAuditLog({
        actorUserId: auth.user.id,
        action: input.action === "regenerate" ? "tournament.draw_regenerated" : "tournament.draw_generated",
        entityType: "tournament",
        entityId: id,
        newData: result,
        request
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("draws.manage");
  if (auth.response) return auth.response;
  const id = await tournamentId(params);
  if (!id) return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });

  try {
    const result = await resetTournamentDraw(id);
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.draw_reset",
      entityType: "tournament",
      entityId: id,
      newData: result,
      request
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
