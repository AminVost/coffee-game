import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import {
  getTournamentScheduleOverview,
  planTournamentSchedule
} from "@/lib/tournament-scheduling";

const schema = z.object({
  mode: z.enum(["preview", "apply"]),
  startAt: z.string().datetime(),
  durationMin: z.coerce.number().int().min(5).max(240),
  roundBreakMin: z.coerce.number().int().min(0).max(120),
  participantRestMin: z.coerce.number().int().min(0).max(120),
  assignReferees: z.boolean().default(false)
});

const messages: Record<string, string> = {
  TOURNAMENT_NOT_FOUND: "مسابقه یافت نشد.",
  TOURNAMENT_NOT_READY_FOR_SCHEDULE: "زمان‌بندی فقط بعد از ساخت قرعه یا هنگام برگزاری مسابقه ممکن است.",
  TOURNAMENT_VENUE_REQUIRED: "ابتدا محل برگزاری مسابقه را تعیین کن.",
  NO_COMPATIBLE_RESOURCES: "در محل مسابقه، میز یا دستگاه سازگار و فعال وجود ندارد.",
  NO_REFEREES: "برای تخصیص خودکار، داور فعال وجود ندارد.",
  INVALID_SCHEDULE_START: "زمان شروع برنامه نامعتبر است.",
  INVALID_TOURNAMENT_TIME_RANGE: "بازه زمانی مسابقه معتبر نیست.",
  SCHEDULE_SLOT_NOT_FOUND: "در بازه مسابقه، زمان بدون تداخل برای همه بازی‌ها پیدا نشد."
};

function parseTournamentId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("matches.manage");
  if (auth.response) return auth.response;

  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
  }

  try {
    const overview = await getTournamentScheduleOverview(tournamentId);
    if (!overview) {
      return NextResponse.json({ message: "مسابقه یافت نشد." }, { status: 404 });
    }
    return NextResponse.json(overview);
  } catch (error) {
    console.error("tournament.schedule.overview_failed", error);
    return NextResponse.json({ message: "دریافت اطلاعات زمان‌بندی انجام نشد." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("matches.manage");
  if (auth.response) return auth.response;

  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
  }

  try {
    const input = schema.parse(await request.json());
    const result = await planTournamentSchedule(tournamentId, {
      ...input,
      startAt: new Date(input.startAt)
    });

    if (input.mode === "apply") {
      await writeAuditLog({
        actorUserId: auth.user.id,
        action: "tournament.matches_scheduled",
        entityType: "tournament",
        entityId: id,
        newData: {
          scheduled: result.scheduled,
          durationMin: input.durationMin,
          roundBreakMin: input.roundBreakMin,
          participantRestMin: input.participantRestMin,
          assignReferees: input.assignReferees
        },
        request
      });
    }

    return NextResponse.json({ ok: true, mode: input.mode, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "تنظیمات زمان‌بندی نامعتبر است." }, { status: 422 });
    }
    const code = error instanceof Error ? error.message : "";
    console.error("tournament.schedule.failed", { tournamentId, code, error });
    const known = Boolean(messages[code]);
    return NextResponse.json(
      { message: messages[code] || "زمان‌بندی بازی‌ها انجام نشد." },
      { status: code === "TOURNAMENT_NOT_FOUND" ? 404 : known ? 409 : 500 }
    );
  }
}
