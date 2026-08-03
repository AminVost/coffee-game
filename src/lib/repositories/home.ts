import { unstable_cache } from "next/cache";
import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";
import { getPageContent } from "@/lib/repositories/content";
import { listHomeLiveMatches } from "@/lib/repositories/live";
import { listHomeTournaments } from "@/lib/repositories/tournaments";

export type HomeDisplaySettings = {
  tournamentsLimit: number;
  liveMatchesLimit: number;
};

type SettingRow = RowDataPacket & { value: unknown };

const defaults: HomeDisplaySettings = {
  tournamentsLimit: 3,
  liveMatchesLimit: 4
};

function parseSettings(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeLimit(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(1, Math.min(12, number)) : fallback;
}

async function loadHomePageData() {
  const settingRows = await queryRows<SettingRow[]>(
    "SELECT value FROM app_settings WHERE `key`='home.settings' LIMIT 1"
  );
  const stored = parseSettings(settingRows[0]?.value);
  const settings: HomeDisplaySettings = {
    tournamentsLimit: normalizeLimit(stored.tournamentsLimit, defaults.tournamentsLimit),
    liveMatchesLimit: normalizeLimit(stored.liveMatchesLimit, defaults.liveMatchesLimit)
  };

  const [tournaments, liveMatches, homeContent] = await Promise.all([
    listHomeTournaments(settings.tournamentsLimit),
    listHomeLiveMatches(settings.liveMatchesLimit),
    getPageContent("home")
  ]);

  return { tournaments, liveMatches, homeContent };
}

/**
 * The home page changes frequently enough to stay fresh, but it does not need
 * to repeat the same database queries for every visitor.
 */
export const getHomePageData = unstable_cache(
  loadHomePageData,
  ["home-page-data-v1"],
  { revalidate: 10, tags: ["home-page"] }
);
