import { TournamentCard } from "@/components/tournament-card";
import { tournaments } from "@/data/mock-data";
export default function MyTournaments(){return <div><p className="section-kicker">MY TOURNAMENTS</p><h1 className="section-title mt-2">مسابقات من</h1><div className="mt-7 grid gap-5 xl:grid-cols-2">{tournaments.slice(0,2).map(t=><TournamentCard key={t.id} tournament={t}/>)}</div></div>}
