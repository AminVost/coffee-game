export const TOURNAMENT_FORMATS = [
  "حذفی تک‌بازی",
  "حذفی رفت‌وبرگشت",
  "دوحذفی",
  "گروهی و سپس حذفی",
  "لیگ دوره‌ای",
  "Swiss System"
] as const;

export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "DRAW_READY",
  "RUNNING",
  "COMPLETED",
  "POSTPONED",
  "CANCELLED"
] as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشرشده؛ ثبت‌نام بسته",
  REGISTRATION_OPEN: "ثبت‌نام باز",
  REGISTRATION_CLOSED: "ثبت‌نام بسته",
  DRAW_READY: "قرعه آماده",
  RUNNING: "در حال برگزاری",
  COMPLETED: "پایان‌یافته",
  POSTPONED: "به‌تعویق‌افتاده",
  CANCELLED: "لغوشده"
};

const ALLOWED_STATUS_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "CANCELLED"],
  PUBLISHED: ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "POSTPONED", "CANCELLED"],
  REGISTRATION_OPEN: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "POSTPONED", "CANCELLED"],
  REGISTRATION_CLOSED: ["REGISTRATION_CLOSED", "REGISTRATION_OPEN", "POSTPONED", "CANCELLED"],
  DRAW_READY: ["DRAW_READY", "POSTPONED", "CANCELLED"],
  RUNNING: ["RUNNING", "POSTPONED", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  POSTPONED: ["POSTPONED", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "CANCELLED"],
  CANCELLED: ["CANCELLED"]
};

export function canChangeTournamentStatus(current: TournamentStatus, next: TournamentStatus) {
  return ALLOWED_STATUS_TRANSITIONS[current].includes(next);
}

export function getTournamentStatusOptions(current: TournamentStatus) {
  return ALLOWED_STATUS_TRANSITIONS[current].map((value) => ({
    value,
    label: TOURNAMENT_STATUS_LABELS[value]
  }));
}

export function getTournamentStatusLabel(status: string) {
  return TOURNAMENT_STATUS_LABELS[status as TournamentStatus] || status;
}

export function tournamentRegistrationWindowError(input: {
  registrationStartsAt?: string | null;
  registrationEndsAt?: string | null;
  startsAt: string;
}) {
  const registrationStart = input.registrationStartsAt
    ? new Date(input.registrationStartsAt).getTime()
    : null;
  const registrationEnd = input.registrationEndsAt
    ? new Date(input.registrationEndsAt).getTime()
    : null;
  const tournamentStart = new Date(input.startsAt).getTime();

  if ((registrationStart === null) !== (registrationEnd === null)) {
    return "شروع و پایان ثبت‌نام باید هر دو تعیین شوند یا هر دو خالی باشند.";
  }
  if (registrationStart !== null && registrationEnd !== null) {
    if (registrationStart >= registrationEnd) {
      return "پایان ثبت‌نام باید بعد از شروع ثبت‌نام باشد.";
    }
    if (registrationEnd >= tournamentStart) {
      return "پایان ثبت‌نام باید پیش از شروع مسابقه باشد.";
    }
  }
  return null;
}

export function openRegistrationStatusError(input: {
  registrationStartsAt?: string | null;
  registrationEndsAt?: string | null;
  startsAt: string;
}, now = Date.now()) {
  const genericError = tournamentRegistrationWindowError(input);
  if (genericError) return genericError;
  if (!input.registrationStartsAt || !input.registrationEndsAt) {
    return "برای بازکردن ثبت‌نام، زمان شروع و پایان ثبت‌نام را تعیین کنید.";
  }
  const registrationStart = new Date(input.registrationStartsAt).getTime();
  const registrationEnd = new Date(input.registrationEndsAt).getTime();
  const tournamentStart = new Date(input.startsAt).getTime();
  if (now < registrationStart || now >= registrationEnd) {
    return "وضعیت «ثبت‌نام باز» فقط در بازه زمانی تعیین‌شده قابل انتخاب است.";
  }
  if (tournamentStart <= now) {
    return "برای بازکردن ثبت‌نام، زمان شروع مسابقه باید در آینده باشد.";
  }
  return null;
}
