export type GameSlug = string;

export type TournamentStatus =
  | "ثبت‌نام باز"
  | "به‌زودی"
  | "در حال برگزاری"
  | "پایان‌یافته";

export interface Tournament {
  id: string;
  slug: string;
  title: string;
  game: GameSlug;
  gameTitle: string;
  format: string;
  participantMode: string;
  participantType: "INDIVIDUAL" | "TEAM";
  teamSize: number;
  status: TournamentStatus;
  statusCode: string;
  date: string;
  time: string;
  venue: string;
  venueType: "internal" | "external";
  capacity: number;
  registered: number;
  remainingCapacity: number;
  allowMultiSlot: boolean;
  waitlistEnabled: boolean;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  startsAt: string;
  price: number;
  prize: string;
  cover: string;
  featured?: boolean;
  description: string;
  rules: string[];
  tags: string[];
}

export interface LiveMatch {
  id: string;
  tournament: string;
  round: string;
  resource: string;
  status: "LIVE" | "NEXT" | "DONE";
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  startsAt: string;
}

export interface RankingRow {
  rank: number;
  name: string;
  avatar: string;
  played: number;
  wins: number;
  points: number;
  trend: number;
}

export interface AdminStat {
  title: string;
  value: string;
  hint: string;
  trend: string;
}
