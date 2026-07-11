import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { getPageContent } from "@/lib/repositories/content";

export const metadata: Metadata = { title: "قوانین" };
export const dynamic = "force-dynamic";

export default async function Rules() {
  const content = await getPageContent("rules");
  return <div className="page-shell max-w-4xl">
    <p className="section-kicker">RULES</p>
    <h1 className="section-title mt-2">{content?.title || "قوانین"}</h1>
    <Card className="mt-8 p-6 sm:p-8"><div className="whitespace-pre-line text-sm leading-9 text-[var(--muted)]">{content?.body}</div></Card>
  </div>;
}
