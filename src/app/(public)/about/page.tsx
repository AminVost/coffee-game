import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { getPageContent } from "@/lib/repositories/content";

export const metadata: Metadata = { title: "درباره ما" };
export const dynamic = "force-dynamic";

export default async function About() {
  const content = await getPageContent("about");
  return <div className="page-shell"><div className="grid items-center gap-8 lg:grid-cols-2"><div><p className="section-kicker">ABOUT US</p><h1 className="section-title mt-2">{content?.title || "Coffee Game ستارخان"}</h1><p className="mt-5 whitespace-pre-line leading-9 text-[var(--muted)]">{content?.body}</p><div className="mt-7 grid grid-cols-3 gap-3"><Card className="p-4 text-center"><strong className="text-2xl">۱۰</strong><span className="mt-1 block text-xs text-[var(--muted)]">کنسول PS5</span></Card><Card className="p-4 text-center"><strong className="text-2xl">۵</strong><span className="mt-1 block text-xs text-[var(--muted)]">تخته‌نرد</span></Card><Card className="p-4 text-center"><strong className="text-2xl">۱</strong><span className="mt-1 block text-xs text-[var(--muted)]">شعبه ستارخان</span></Card></div></div><div className="overflow-hidden rounded-[2.5rem] border border-[var(--line)]"><Image src="/brand/logo-dark.png" alt="Coffee Game" width={900} height={700} className="w-full object-cover"/></div></div></div>;
}
