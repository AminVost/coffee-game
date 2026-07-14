import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute } from "@/lib/db";
import { listTournaments } from "@/lib/repositories/tournaments";

export async function GET() {
  return NextResponse.json({ items: await listTournaments() });
}

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  gameId: z.number().int().positive(),
  templateId: z.number().int().positive().nullable().optional(),
  venueId: z.number().int().positive().nullable().optional(),
  format: z.string().trim().min(2).max(60),
  participantType: z.enum(["INDIVIDUAL", "TEAM"]).default("INDIVIDUAL"),
  teamSize: z.number().int().min(1).max(10).default(1),
  capacity: z.number().int().min(2).max(1000),
  price: z.number().int().min(0),
  startsAt: z.string().datetime(),
  reservationExpiresMin: z.number().int().min(5).max(1440).default(30),
  lateToleranceMin: z.number().int().min(0).max(180).default(10),
  waitlistMode: z.enum(["offer", "manual", "automatic"]).default("offer"),
  allowMultiSlot: z.boolean().default(false),
  hasThirdPlace: z.boolean().default(false),
  drawMode: z.enum(["random", "seeded", "custom"]).default("random"),
  rules: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "REGISTRATION_OPEN"]).default("DRAFT")
});

export async function POST(request: Request) {
  const auth = await authorize("tournaments.manage");
  if (auth.response) return auth.response;

  try {
    const input = schema.parse(await request.json());

    if (input.participantType === "INDIVIDUAL" && input.teamSize !== 1) {
      return NextResponse.json({ message: "اندازه تیم برای مسابقه انفرادی باید ۱ باشد." }, { status: 422 });
    }

    const result = await execute(`
      INSERT INTO tournaments(
        public_id,slug,title,description,game_id,template_id,venue_id,format,
        participant_type,team_size,capacity,min_participants,price,currency,status,
        starts_at,reservation_expires_min,late_tolerance_min,waitlist_mode,
        allow_multi_slot,has_third_place,draw_mode,rules,published_at,created_at,updated_at
      ) VALUES(
        UUID(),?,?,?,?,?,?,?,?,?,?,2,?,'TOMAN',?,?,?,?,?,?,?,?,?,
        IF(? IN ('PUBLISHED','REGISTRATION_OPEN'),NOW(),NULL),NOW(),NOW()
      )
    `, [
      input.slug,
      input.title,
      input.description || null,
      input.gameId,
      input.templateId || null,
      input.venueId || null,
      input.format,
      input.participantType,
      input.teamSize,
      input.capacity,
      input.price,
      input.status,
      new Date(input.startsAt),
      input.reservationExpiresMin,
      input.lateToleranceMin,
      input.waitlistMode,
      input.allowMultiSlot ? 1 : 0,
      input.hasThirdPlace ? 1 : 0,
      input.drawMode,
      JSON.stringify(input.rules),
      input.status
    ]);

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "tournament.created",
      entityType: "tournament",
      entityId: result.insertId,
      newData: input,
      request
    });

    return NextResponse.json({ ok: true, id: String(result.insertId), slug: input.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "داده مسابقه نامعتبر است.", errors: error.issues }, { status: 422 });
    }
    if (error instanceof Error && error.message.includes("uq_tournaments_slug")) {
      return NextResponse.json({ message: "این آدرس مسابقه قبلاً استفاده شده است." }, { status: 409 });
    }
    console.error("tournament.create.failed", error);
    return NextResponse.json({ message: "ثبت مسابقه انجام نشد." }, { status: 500 });
  }
}
