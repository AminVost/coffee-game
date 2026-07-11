import { ArrowUpLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AdminStat } from "@/types";
export function StatCard({stat}:{stat:AdminStat}){return <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-[var(--muted)]">{stat.title}</p><strong className="mt-3 block text-2xl font-black">{stat.value}</strong></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500"><ArrowUpLeft size={18}/></span></div><div className="mt-5 flex items-center justify-between text-xs"><span className="text-[var(--muted)]">{stat.hint}</span><span className="font-black text-emerald-500">{stat.trend}</span></div></Card>}
