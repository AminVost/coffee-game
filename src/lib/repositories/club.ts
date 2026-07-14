import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";

type SettingRow = RowDataPacket & {
  key: string;
  value: unknown;
};

export type ClubPublicSettings = {
  name: string;
  phone: string;
  address: string;
  ps5Count: number;
  backgammonTableCount: number;
};

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function getClubPublicSettings(): Promise<ClubPublicSettings> {
  const rows = await queryRows<SettingRow[]>(`
    SELECT \`key\`,value
    FROM app_settings
    WHERE is_public=1 AND \`key\` IN ('club.profile','club.resources')
  `);

  const settings = Object.fromEntries(rows.map((row) => [row.key, parseJson(row.value)]));
  const profile = settings["club.profile"] || {};
  const resources = settings["club.resources"] || {};

  return {
    name: typeof profile.name === "string" ? profile.name : "",
    phone: typeof profile.phone === "string" ? profile.phone : "",
    address: typeof profile.address === "string" ? profile.address : "",
    ps5Count: Number(resources.ps5 || 0),
    backgammonTableCount: Number(resources.backgammonTables || 0)
  };
}
