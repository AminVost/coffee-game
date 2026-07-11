import { tournaments as mockTournaments } from "@/data/mock-data";
import { env } from "@/lib/env";
import { queryRows } from "@/lib/db";
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
  cover_image_url: string | null;
  is_featured: number;
  game_slug: string;
  game_title: string;
  venue_title: string | null;
  venue_type: string | null;
  registered_count: number;
};

function mapDbTournament(item: TournamentRow): Tournament {
  const statusMap: Record<string, Tournament["status"]> = {
    REGISTRATION_OPEN: "ثبت‌نام باز",
    PUBLISHED: "به‌زودی",
    RUNNING: "در حال برگزاری",
    COMPLETED: "پایان‌یافته"
  };
  const startsAt = new Date(item.starts_at);
  return {
    id: String(item.id),
    slug: item.slug,
    title: item.title,
    game: item.game_slug === "backgammon" ? "backgammon" : "fc26",
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
    prize: "طبق توضیحات مسابقه",
    cover: item.cover_image_url || "linear-gradient(135deg,#0d7c47,#111827,#d4a11f)",
    featured: Boolean(item.is_featured),
    description: item.description || "",
    rules: [],
    tags: [item.game_title, item.format]
  };
}

const baseSql = `
  SELECT t.id, t.slug, t.title, t.description, t.format, t.participant_type,
         t.team_size, t.status, t.starts_at, t.capacity, t.price,
         t.cover_image_url, t.is_featured, g.slug AS game_slug,
         g.title AS game_title, v.title AS venue_title, v.type AS venue_type,
         COALESCE(SUM(CASE
           WHEN r.status IN ('RESERVED','PENDING_APPROVAL','CONFIRMED','CHECKED_IN') THEN r.slots
           WHEN r.status='PENDING_PAYMENT' AND (r.reserved_until IS NULL OR r.reserved_until>NOW()) THEN r.slots
           ELSE 0
         END),0) AS registered_count
  FROM tournaments t
  JOIN games g ON g.id = t.game_id
  LEFT JOIN venues v ON v.id = t.venue_id
  LEFT JOIN registrations r ON r.tournament_id = t.id
    AND r.deleted_at IS NULL
  WHERE t.deleted_at IS NULL
`;

export async function listTournaments(): Promise<Tournament[]> {
  if (env.dataMode === "mock") return mockTournaments;
  const rows = await queryRows<TournamentRow[]>(`${baseSql} GROUP BY t.id ORDER BY t.is_featured DESC, t.starts_at ASC`);
  return rows.map(mapDbTournament);
}

export async function findTournament(slug: string): Promise<Tournament | null> {
  if (env.dataMode === "mock") return mockTournaments.find((item) => item.slug === slug) || null;
  const rows = await queryRows<TournamentRow[]>(`${baseSql} AND t.slug = ? GROUP BY t.id LIMIT 1`, [slug]);
  return rows[0] ? mapDbTournament(rows[0]) : null;
}
