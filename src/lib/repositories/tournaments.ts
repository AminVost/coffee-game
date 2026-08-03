import { queryRows } from "@/lib/db";
import { formatToman } from "@/lib/utils";
import type { Tournament } from "@/types";
import type { RowDataPacket } from "mysql2";

type TournamentRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  format: string;
  participant_type: string;
  team_size: number;
  status: string;
  registration_starts_at: Date | null;
  registration_ends_at: Date | null;
  starts_at: Date;
  allow_multi_slot: number;
  waitlist_mode: string;
  capacity: number;
  price: number;
  rules: unknown;
  prize_settings: unknown;
  cover_image_url: string | null;
  is_featured: number;
  game_slug: string;
  game_title: string;
  venue_title: string | null;
  venue_type: string | null;
  registered_count: number;
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function mapRules(value: unknown): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function mapPrize(value: unknown): string {
  const parsed = parseJson(value);
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "جایزه هنوز اعلام نشده است";

  const data = parsed as Record<string, unknown>;
  if (typeof data.title === "string" && data.title.trim()) return data.title.trim();

  const labels: Record<string, string> = {
    first: "نفر اول",
    second: "نفر دوم",
    third: "نفر سوم",
    total: "مجموع جوایز"
  };
  const parts = Object.entries(labels)
    .filter(([key]) => typeof data[key] === "number" || /^\d+$/.test(String(data[key] ?? "")))
    .map(([key, label]) => `${label}: ${formatToman(Number(data[key]))}`);

  return parts.length ? parts.join(" · ") : "جایزه هنوز اعلام نشده است";
}

function mapDbTournament(item: TournamentRow): Tournament {
  const statusMap: Record<string, Tournament["status"]> = {
    REGISTRATION_OPEN: "ثبت‌نام باز",
    PUBLISHED: "به‌زودی",
    REGISTRATION_CLOSED: "به‌زودی",
    DRAW_READY: "به‌زودی",
    RUNNING: "در حال برگزاری",
    COMPLETED: "پایان‌یافته",
    POSTPONED: "به‌زودی",
    CANCELLED: "پایان‌یافته"
  };
  const startsAt = new Date(item.starts_at);
  return {
    id: String(item.id),
    slug: item.slug,
    title: item.title,
    game: item.game_slug,
    gameTitle: item.game_title,
    format: item.format,
    participantMode: item.participant_type === "TEAM" ? `تیمی ${item.team_size} نفره` : "انفرادی",
    participantType: item.participant_type === "TEAM" ? "TEAM" : "INDIVIDUAL",
    teamSize: Number(item.team_size || 1),
    status: statusMap[item.status] || "به‌زودی",
    statusCode: item.status,
    date: new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(startsAt),
    time: new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(startsAt),
    venue: item.venue_title || "محل اعلام می‌شود",
    venueType: item.venue_type === "external" ? "external" : "internal",
    capacity: Number(item.capacity),
    registered: Number(item.registered_count || 0),
    remainingCapacity: Math.max(0, Number(item.capacity) - Number(item.registered_count || 0)),
    allowMultiSlot: Boolean(item.allow_multi_slot),
    waitlistEnabled: item.waitlist_mode !== "disabled",
    registrationStartsAt: item.registration_starts_at ? new Date(item.registration_starts_at).toISOString() : null,
    registrationEndsAt: item.registration_ends_at ? new Date(item.registration_ends_at).toISOString() : null,
    startsAt: startsAt.toISOString(),
    price: Number(item.price),
    prize: mapPrize(item.prize_settings),
    cover: item.cover_image_url || "linear-gradient(135deg,#0d7c47,#111827,#d4a11f)",
    featured: Boolean(item.is_featured),
    description: item.description || "",
    rules: mapRules(item.rules),
    tags: [item.game_title, item.format]
  };
}

const baseSql = `
  SELECT
    t.id,t.slug,t.title,t.description,t.format,t.participant_type,
    t.team_size,t.status,t.registration_starts_at,t.registration_ends_at,t.starts_at,
    t.allow_multi_slot,t.waitlist_mode,t.capacity,t.price,t.rules,t.prize_settings,
    t.cover_image_url,t.is_featured,g.slug AS game_slug,
    g.title AS game_title,v.title AS venue_title,v.type AS venue_type,
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN r.status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN r.slots
          WHEN r.status='PENDING_PAYMENT' AND (r.reserved_until IS NULL OR r.reserved_until>NOW()) THEN r.slots
          WHEN r.status='NEEDS_CORRECTION' AND r.correction_expires_at>NOW() THEN r.slots
          ELSE 0
        END
      ),0)
      FROM registrations r
      WHERE r.tournament_id=t.id AND r.deleted_at IS NULL
    )
    +
    (
      SELECT COALESCE(SUM(rh.slots),0)
      FROM registration_holds rh
      WHERE rh.tournament_id=t.id
        AND rh.status='ACTIVE'
        AND rh.expires_at>NOW()
    )
    +
    (
      SELECT COALESCE(SUM(w.slots),0)
      FROM waitlist_entries w
      WHERE w.tournament_id=t.id
        AND w.status='OFFERED'
        AND w.offer_expires_at>NOW()
    ) AS registered_count
  FROM tournaments t
  JOIN games g ON g.id=t.game_id
  LEFT JOIN venues v ON v.id=t.venue_id
  WHERE t.deleted_at IS NULL
`;

export async function listTournaments(includeNonPublic = false): Promise<Tournament[]> {
  const visibility = includeNonPublic ? "" : " AND t.status NOT IN ('DRAFT','CANCELLED')";
  const rows = await queryRows<TournamentRow[]>(`${baseSql}${visibility} ORDER BY t.is_featured DESC,t.starts_at ASC`);
  return rows.map(mapDbTournament);
}

/**
 * Lightweight query used only by the home page.
 * The tournament list is limited before capacity subqueries are evaluated,
 * so the database does not calculate capacity for every tournament.
 */
export async function listHomeTournaments(requestedLimit: number): Promise<Tournament[]> {
  const limit = Math.max(1, Math.min(12, Math.trunc(requestedLimit || 3)));
  const rows = await queryRows<TournamentRow[]>(`
    SELECT
      c.id,c.slug,c.title,c.description,c.format,c.participant_type,
      c.team_size,c.status,c.registration_starts_at,c.registration_ends_at,c.starts_at,
      c.allow_multi_slot,c.waitlist_mode,c.capacity,c.price,c.rules,c.prize_settings,
      c.cover_image_url,c.is_featured,c.game_slug,c.game_title,c.venue_title,c.venue_type,
      (
        SELECT COALESCE(SUM(
          CASE
            WHEN r.status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN r.slots
            WHEN r.status='PENDING_PAYMENT' AND (r.reserved_until IS NULL OR r.reserved_until>NOW()) THEN r.slots
            WHEN r.status='NEEDS_CORRECTION' AND r.correction_expires_at>NOW() THEN r.slots
            ELSE 0
          END
        ),0)
        FROM registrations r
        WHERE r.tournament_id=c.id AND r.deleted_at IS NULL
      )
      +
      (
        SELECT COALESCE(SUM(rh.slots),0)
        FROM registration_holds rh
        WHERE rh.tournament_id=c.id
          AND rh.status='ACTIVE'
          AND rh.expires_at>NOW()
      )
      +
      (
        SELECT COALESCE(SUM(w.slots),0)
        FROM waitlist_entries w
        WHERE w.tournament_id=c.id
          AND w.status='OFFERED'
          AND w.offer_expires_at>NOW()
      ) AS registered_count
    FROM (
      SELECT
        t.id,t.slug,t.title,t.description,t.format,t.participant_type,
        t.team_size,t.status,t.registration_starts_at,t.registration_ends_at,t.starts_at,
        t.allow_multi_slot,t.waitlist_mode,t.capacity,t.price,t.rules,t.prize_settings,
        t.cover_image_url,t.is_featured,g.slug AS game_slug,g.title AS game_title,
        v.title AS venue_title,v.type AS venue_type
      FROM tournaments t
      JOIN games g ON g.id=t.game_id
      LEFT JOIN venues v ON v.id=t.venue_id
      WHERE t.deleted_at IS NULL
        AND t.status IN ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_READY','RUNNING','POSTPONED')
      ORDER BY
        t.is_featured DESC,
        FIELD(t.status,'REGISTRATION_OPEN','RUNNING','PUBLISHED','REGISTRATION_CLOSED','DRAW_READY','POSTPONED'),
        t.starts_at ASC,
        t.id ASC
      LIMIT ${limit}
    ) c
  `);
  return rows.map(mapDbTournament);
}

export async function findTournament(slug: string): Promise<Tournament | null> {
  const rows = await queryRows<TournamentRow[]>(`${baseSql} AND t.slug=? AND t.status NOT IN ('DRAFT','CANCELLED') LIMIT 1`, [slug]);
  return rows[0] ? mapDbTournament(rows[0]) : null;
}
