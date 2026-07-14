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
  starts_at: Date;
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
    status: statusMap[item.status] || "به‌زودی",
    date: new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(startsAt),
    time: new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(startsAt),
    venue: item.venue_title || "محل اعلام می‌شود",
    venueType: item.venue_type === "external" ? "external" : "internal",
    capacity: item.capacity,
    registered: Number(item.registered_count || 0),
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
    t.team_size,t.status,t.starts_at,t.capacity,t.price,t.rules,t.prize_settings,
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
    ) AS registered_count
  FROM tournaments t
  JOIN games g ON g.id=t.game_id
  LEFT JOIN venues v ON v.id=t.venue_id
  WHERE t.deleted_at IS NULL
`;

export async function listTournaments(): Promise<Tournament[]> {
  const rows = await queryRows<TournamentRow[]>(`${baseSql} ORDER BY t.is_featured DESC,t.starts_at ASC`);
  return rows.map(mapDbTournament);
}

export async function findTournament(slug: string): Promise<Tournament | null> {
  const rows = await queryRows<TournamentRow[]>(`${baseSql} AND t.slug=? LIMIT 1`, [slug]);
  return rows[0] ? mapDbTournament(rows[0]) : null;
}
