import type { Metadata } from "next";
import { Radio } from "lucide-react";
import { LiveBoard } from "@/components/live/live-board";
import { listLiveMatches } from "@/lib/repositories/live";

export const metadata: Metadata = { title: "نتایج زنده" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const items = await listLiveMatches();
  return <div className="page-shell">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="section-kicker">LIVE CENTER</p>
        <h1 className="section-title mt-2 flex items-center gap-3"><Radio className="text-red-500"/>نتایج و برنامه زنده</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">اطلاعات این صفحه هر ۱۵ ثانیه از دیتابیس بروزرسانی می‌شود.</p>
      </div>
    </div>
    <div className="mt-6"><LiveBoard initialItems={items}/></div>
  </div>;
}
