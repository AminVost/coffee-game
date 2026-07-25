import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

type BracketMatch = {
  roundId: number;
  roundTitle: string;
  roundNumber: number;
  stage: string;
  matchId: number;
  matchNumber: number;
  status: string;
  scheduledAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeName: string | null;
  awayName: string | null;
  homeSeed?: number | null;
  awaySeed?: number | null;
};

const stageTitle: Record<string, string> = {
  knockout: "براکت حذفی",
  third_place: "رده‌بندی سوم",
  swiss: "سیستم سوئیسی",
  league: "لیگ",
  double_winners: "براکت برندگان",
  double_losers: "براکت بازندگان",
  double_final: "فینال دوحذفی",
  double_reset: "فینال مجدد"
};

function participant(name: string | null, seed?: number | null) {
  return <span className="flex min-w-0 items-center gap-2">
    {seed ? <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-[var(--brand)]/12 px-1 text-[10px] font-black text-[var(--brand)]">{seed.toLocaleString("fa-IR")}</span> : null}
    <strong className="truncate">{name || "استراحت"}</strong>
  </span>;
}

export function TournamentBracket({ matches, compact = false }: { matches: BracketMatch[]; compact?: boolean }) {
  const stages = new Map<string, Map<number, { title: string; matches: BracketMatch[] }>>();
  for (const match of matches) {
    const stage = stages.get(match.stage) || new Map();
    const round = stage.get(match.roundId) || { title: match.roundTitle, matches: [] };
    round.matches.push(match);
    stage.set(match.roundId, round);
    stages.set(match.stage, stage);
  }

  return <div className="grid gap-8">
    {[...stages.entries()].map(([stage, rounds]) => <section key={stage}>
      <div className="mb-4 flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
        <h3 className="font-black">{stageTitle[stage] || stage.replaceAll("_", " ")}</h3>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max items-stretch gap-8">
          {[...rounds.entries()].map(([roundId, round], roundIndex) => {
            const gap = compact ? 12 : Math.min(80, 14 + roundIndex * 18);
            return <div key={roundId} className="relative w-[290px] shrink-0">
              <div className="mb-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-center text-xs font-black text-[var(--muted)]">{round.title}</div>
              <div className="flex h-full flex-col justify-around" style={{ gap }}>
                {round.matches.map((match) => <article key={match.matchId} className={cn("relative rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm", !compact && "after:absolute after:-left-8 after:top-1/2 after:hidden after:h-px after:w-8 after:bg-[var(--line)] md:after:block")}>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2">{participant(match.homeName, match.homeSeed)}<b>{match.homeScore ?? "-"}</b></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2">{participant(match.awayName, match.awaySeed)}<b>{match.awayScore ?? "-"}</b></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)]">
                    <span>بازی {match.matchNumber.toLocaleString("fa-IR")} · {match.status}</span>
                    {match.scheduledAt ? <span className="flex items-center gap-1"><CalendarClock size={11}/>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"short",timeStyle:"short"}).format(new Date(match.scheduledAt))}</span> : null}
                  </div>
                </article>)}
              </div>
            </div>;
          })}
        </div>
      </div>
    </section>)}
  </div>;
}
