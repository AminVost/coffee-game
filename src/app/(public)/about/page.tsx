import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { getPageContent } from "@/lib/repositories/content";
import { getClubPublicSettings } from "@/lib/repositories/club";

export const metadata: Metadata = { title: "درباره ما" };
export const dynamic = "force-dynamic";

export default async function About() {
  const [content, club] = await Promise.all([
    getPageContent("about"),
    getClubPublicSettings()
  ]);

  const stats = [
    [club.ps5Count, "کنسول PS5"],
    [club.backgammonTableCount, "میز تخته‌نرد"]
  ].filter(([value]) => Number(value) > 0);

  return <div className="page-shell">
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <div>
        <p className="section-kicker">ABOUT US</p>
        <h1 className="section-title mt-2">{content?.title || club.name || "درباره مجموعه"}</h1>
        {content?.body && <p className="mt-5 whitespace-pre-line leading-9 text-[var(--muted)]">{content.body}</p>}
        {stats.length > 0 && <div className="mt-7 grid grid-cols-2 gap-3">
          {stats.map(([value, label]) => <Card key={String(label)} className="p-4 text-center">
            <strong className="text-2xl">{Number(value).toLocaleString("fa-IR")}</strong>
            <span className="mt-1 block text-xs text-[var(--muted)]">{String(label)}</span>
          </Card>)}
        </div>}
      </div>
      <div className="overflow-hidden rounded-[2.5rem] border border-[var(--line)]">
        <Image src="/brand/logo-dark.png" alt={club.name || "Coffee Game"} width={900} height={700} className="w-full object-cover" />
      </div>
    </div>
  </div>;
}
