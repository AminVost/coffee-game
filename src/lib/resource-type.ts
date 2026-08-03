function parseSettings(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function getRequiredResourceType(gameSlug: string, gameSettings: unknown) {
  const settings = parseSettings(gameSettings);
  const configured = String(settings.resourceType || "").trim().toLowerCase();
  if (["table", "backgammon", "backgammon-table", "backgammon_table"].includes(configured)) {
    return "backgammon_table";
  }
  if (["console", "playstation", "playstation5", "ps5"].includes(configured)) {
    return "ps5";
  }
  if (configured) return configured;
  return gameSlug.toLowerCase().includes("backgammon") ? "backgammon_table" : "ps5";
}
