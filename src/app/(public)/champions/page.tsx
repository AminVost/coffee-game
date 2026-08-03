import { Medal, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listCompletedTournamentChampions } from "@/lib/tournament-completion";

export const dynamic = "force-dynamic";

export default async function Champions() {
  const champions = await listCompletedTournamentChampions(30);

  return (
    <div className="page-shell">
      <p className="section-kicker">HALL OF FAME</p>
      <h1 className="section-title mt-2">قهرمانان Coffee Game</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
        فقط مسابقه‌هایی نمایش داده می‌شوند که تمام بازی‌هایشان پایان یافته، اعتراض بازی باز ندارند و قهرمان نهایی آن‌ها مشخص است.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {champions.map((item) => (
          <Card key={item.tournamentId} className="p-7 text-center">
            <Trophy className="mx-auto text-amber-500" size={42} />
            <h2 className="mt-5 text-xl font-black">{item.champion?.name}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.title}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{item.format}</p>
            {item.runnerUp && (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] p-3 text-xs">
                <Medal size={15} className="text-slate-400" />
                نایب‌قهرمان: <strong>{item.runnerUp.name}</strong>
              </div>
            )}
          </Card>
        ))}
      </div>
      {!champions.length && (
        <Card className="mt-8 p-10 text-center text-[var(--muted)]">
          هنوز قهرمان نهایی بدون اعتراض باز ثبت نشده است.
        </Card>
      )}
    </div>
  );
}
