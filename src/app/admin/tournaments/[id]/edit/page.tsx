import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { TournamentEditForm } from "@/components/admin/tournament-edit-form";
import { queryRows } from "@/lib/db";
import { requireAdminPage } from "@/lib/page-authorization";
import type { TournamentFormat, TournamentStatus } from "@/lib/tournament-definition";

function localDate(value: Date | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function json(value: unknown) {
  try {
    return JSON.stringify(typeof value === "string" ? JSON.parse(value) : value || {}, null, 2);
  } catch {
    return "{}";
  }
}

export default async function EditTournament({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("tournaments.manage");
  const { id } = await params;

  const [rows, games, venues, templates, countRows] = await Promise.all([
    queryRows<RowDataPacket[]>(`
      SELECT * FROM tournaments WHERE id=? AND deleted_at IS NULL LIMIT 1
    `, [id]),
    queryRows<RowDataPacket[]>(`SELECT id,title FROM games WHERE is_active=1 ORDER BY title`),
    queryRows<RowDataPacket[]>(`SELECT id,title FROM venues WHERE is_active=1 ORDER BY title`),
    queryRows<RowDataPacket[]>(`SELECT id,title FROM tournament_templates WHERE is_active=1 ORDER BY title`),
    queryRows<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM registrations WHERE tournament_id=? AND deleted_at IS NULL) AS registration_count,
        (
          SELECT COUNT(*)
          FROM registrations
          WHERE tournament_id=?
            AND deleted_at IS NULL
            AND status NOT IN ('CANCELLED','REJECTED','EXPIRED','NO_SHOW')
        ) AS active_registration_count,
        (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id=?) AS match_count,
        (
          SELECT COUNT(*)
          FROM registration_holds
          WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()
        ) AS hold_count,
        (
          SELECT COUNT(*)
          FROM waitlist_entries
          WHERE tournament_id=? AND status IN ('WAITING','OFFERED')
        ) AS waitlist_count,
        (
          SELECT COALESCE(SUM(
            CASE
              WHEN status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN slots
              WHEN status='PENDING_PAYMENT' AND (reserved_until IS NULL OR reserved_until>NOW()) THEN slots
              WHEN status='NEEDS_CORRECTION' AND correction_expires_at>NOW() THEN slots
              ELSE 0
            END
          ),0)
          FROM registrations
          WHERE tournament_id=? AND deleted_at IS NULL
        )
        +
        (
          SELECT COALESCE(SUM(slots),0)
          FROM registration_holds
          WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()
        )
        +
        (
          SELECT COALESCE(SUM(slots),0)
          FROM waitlist_entries
          WHERE tournament_id=? AND status='OFFERED' AND offer_expires_at>NOW()
        ) AS occupied
    `, [id, id, id, id, id, id, id, id])
  ]);

  const row = rows[0];
  if (!row) notFound();

  const rules = typeof row.rules === "string" ? JSON.parse(row.rules || "[]") : row.rules || [];
  const counts = countRows[0] || {};

  const initial = {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    subtitle: String(row.subtitle || ""),
    description: String(row.description || ""),
    gameId: Number(row.game_id),
    templateId: row.template_id ? Number(row.template_id) : null,
    venueId: row.venue_id ? Number(row.venue_id) : null,
    format: String(row.format) as TournamentFormat,
    participantType: row.participant_type as "INDIVIDUAL" | "TEAM",
    teamSize: Number(row.team_size),
    capacity: Number(row.capacity),
    minParticipants: Number(row.min_participants),
    price: Number(row.price),
    status: String(row.status) as TournamentStatus,
    registrationStartsAt: localDate(row.registration_starts_at),
    registrationEndsAt: localDate(row.registration_ends_at),
    startsAt: localDate(row.starts_at),
    endsAt: localDate(row.ends_at),
    reservationExpiresMin: Number(row.reservation_expires_min),
    lateToleranceMin: Number(row.late_tolerance_min),
    waitlistMode: String(row.waitlist_mode) as "disabled" | "offer" | "manual" | "automatic",
    allowMultiSlot: Boolean(row.allow_multi_slot),
    hasThirdPlace: Boolean(row.has_third_place),
    drawMode: String(row.draw_mode) as "random" | "seeded" | "custom",
    rulesText: Array.isArray(rules) ? rules.join("\n") : "",
    gameSettingsText: json(row.game_settings),
    scoringSettingsText: json(row.scoring_settings),
    notificationSettingsText: json(row.notification_settings),
    cancellationSettingsText: json(row.cancellation_settings),
    prizeSettingsText: json(row.prize_settings),
    coverImageUrl: String(row.cover_image_url || ""),
    isFeatured: Boolean(row.is_featured)
  };

  const meta = {
    registrationCount: Number(counts.registration_count || 0),
    activeRegistrationCount: Number(counts.active_registration_count || 0),
    matchCount: Number(counts.match_count || 0),
    holdCount: Number(counts.hold_count || 0),
    waitlistCount: Number(counts.waitlist_count || 0),
    occupied: Number(counts.occupied || 0)
  };

  return <div>
    <p className="section-kicker">EDIT TOURNAMENT</p>
    <h1 className="section-title mt-2">ویرایش مسابقه</h1>
    <p className="mt-2 text-sm text-[var(--muted)]">فیلدهایی که به ثبت‌نام یا قرعه وابسته‌اند، بعد از ایجاد داده عملیاتی به‌صورت خودکار قفل می‌شوند.</p>
    <TournamentEditForm
      initial={initial}
      games={games.map((item) => ({ id: Number(item.id), title: String(item.title) }))}
      venues={venues.map((item) => ({ id: Number(item.id), title: String(item.title) }))}
      templates={templates.map((item) => ({ id: Number(item.id), title: String(item.title) }))}
      meta={meta}
    />
  </div>;
}
