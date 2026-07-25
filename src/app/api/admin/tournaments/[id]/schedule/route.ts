import { NextResponse } from "next/server";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { scheduleTournamentMatches } from "@/lib/tournament-engine";

const messages: Record<string, string> = {
  TOURNAMENT_NOT_FOUND: "مسابقه یافت نشد.",
  TOURNAMENT_VENUE_REQUIRED: "ابتدا محل برگزاری مسابقه را تعیین کنید.",
  NO_RESOURCES: "منبع فعالی برای زمان‌بندی در محل مسابقه وجود ندارد.",
  SCHEDULE_SLOT_NOT_FOUND: "بازه بدون تداخل برای زمان‌بندی همه بازی‌ها پیدا نشد."
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("matches.manage");
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: "شناسه مسابقه نامعتبر است." }, { status: 400 });
  try {
    const result = await scheduleTournamentMatches(Number(id));
    await writeAuditLog({ actorUserId: auth.user.id, action: "tournament.matches_scheduled", entityType: "tournament", entityId: id, newData: result, request });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: messages[code] || "زمان‌بندی بازی‌ها انجام نشد." }, { status: code === "TOURNAMENT_NOT_FOUND" ? 404 : 409 });
  }
}
