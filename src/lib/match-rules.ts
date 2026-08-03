export type MatchCategory = "knockout" | "league" | "group" | "swiss" | "double";

function parseObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function getMatchCategory(format: string): MatchCategory {
  const normalized = format.toLowerCase();
  if (normalized.includes("دوحذفی") || normalized.includes("double elimination")) return "double";
  if (normalized.includes("swiss") || normalized.includes("سوئیس")) return "swiss";
  if (normalized.includes("گروه") || normalized.includes("group")) return "group";
  if (normalized.includes("لیگ") || normalized.includes("league") || normalized.includes("round robin")) return "league";
  return "knockout";
}

export function getMatchResultRules(format: string, gameSettings: unknown) {
  const settings = parseObject(gameSettings);
  const category = getMatchCategory(format);
  const targetScore = positiveNumber(
    settings.targetPoints ?? settings.targetScore ?? settings.winningScore
  );
  const configuredMaximum = positiveNumber(settings.maxScore);
  const maxScore = Math.max(1, Math.min(999, Math.round(configuredMaximum ?? targetScore ?? 999)));
  const allowDraw = settings.allowDraw === true
    || category === "league"
    || category === "group"
    || category === "swiss"
    || format.toLowerCase().includes("رفت‌وبرگشت")
    || format.toLowerCase().includes("رفت و برگشت")
    || format.toLowerCase().includes("two leg")
    || format.toLowerCase().includes("home and away");

  return {
    category,
    maxScore,
    targetScore: targetScore ? Math.round(targetScore) : null,
    allowDraw
  };
}

export const MATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار برنامه",
  READY: "آماده شروع",
  LIVE: "در حال برگزاری",
  COMPLETED: "پایان‌یافته",
  POSTPONED: "به تعویق افتاده",
  CANCELLED: "لغوشده"
};
