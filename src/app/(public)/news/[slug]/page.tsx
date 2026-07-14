import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

type AnnouncementRow = RowDataPacket & {
  title: string;
  body: string;
  image_url: string | null;
  published_at: Date | null;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const rows = await queryRows<(RowDataPacket & { title: string; excerpt: string | null })[]>(`
    SELECT title,excerpt FROM announcements
    WHERE slug=? AND is_published=1 AND (published_at IS NULL OR published_at<=NOW())
    LIMIT 1
  `, [slug]);
  return rows[0] ? { title: rows[0].title, description: rows[0].excerpt || undefined } : {};
}

export const dynamic = "force-dynamic";

export default async function NewsDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await queryRows<AnnouncementRow[]>(`
    SELECT title,body,image_url,published_at
    FROM announcements
    WHERE slug=? AND is_published=1 AND (published_at IS NULL OR published_at<=NOW())
    LIMIT 1
  `, [slug]);
  const item = rows[0];
  if (!item) notFound();

  return (
    <div className="page-shell max-w-4xl">
      <p className="section-kicker">NEWS</p>
      <h1 className="section-title mt-2">{item.title}</h1>
      <p className="mt-3 text-xs text-[var(--muted)]">
        <CalendarDays size={14} className="ml-1 inline" />
        {item.published_at ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short" }).format(new Date(item.published_at)) : "بدون تاریخ"}
      </p>
      {item.image_url && <div className="mt-7 aspect-[16/8] rounded-[1.75rem] bg-cover bg-center" style={{ backgroundImage: `url(${item.image_url})` }} />}
      <Card className="mt-7 whitespace-pre-line p-6 leading-9 sm:p-9">{item.body}</Card>
    </div>
  );
}
