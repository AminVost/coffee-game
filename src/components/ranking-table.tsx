import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { RankingRow } from "@/types";

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  return <div className="overflow-x-auto rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)]">
    <table className="w-full min-w-[620px] text-right text-sm">
      <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]"><tr><th className="p-4">رتبه</th><th className="p-4">بازیکن</th><th className="p-4">بازی</th><th className="p-4">برد</th><th className="p-4">امتیاز</th><th className="p-4">روند</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.rank} className="border-t border-[var(--line)]"><td className="p-4"><span className={`grid h-9 w-9 place-items-center rounded-xl font-black ${row.rank <= 3 ? "bg-amber-500/15 text-amber-500" : "bg-[var(--surface-2)]"}`}>{row.rank}</span></td><td className="p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)]/15 font-black text-[var(--brand)]">{row.avatar}</span><strong>{row.name}</strong></div></td><td className="p-4 text-[var(--muted)]">{row.played}</td><td className="p-4 text-[var(--muted)]">{row.wins}</td><td className="p-4 font-black">{row.points.toLocaleString("fa-IR")}</td><td className="p-4">{row.trend > 0 ? <span className="flex items-center gap-1 text-emerald-500"><ArrowUp size={15}/>{row.trend}</span> : row.trend < 0 ? <span className="flex items-center gap-1 text-red-500"><ArrowDown size={15}/>{Math.abs(row.trend)}</span> : <Minus size={15} className="text-[var(--muted)]"/>}</td></tr>)}</tbody>
    </table>
  </div>;
}
