import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

export const metadata: Metadata = { title: "اخبار" };
export const dynamic = "force-dynamic";

type AnnouncementRow = RowDataPacket & {
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: Date | null;
};

export default async function News() {
  const items = await queryRows<AnnouncementRow[]>(`
    SELECT slug,title,excerpt,published_at
    FROM announcements
    WHERE is_published=1 AND (published_at IS NULL OR published_at<=NOW())
    ORDER BY COALESCE(published_at,created_at) DESC,id DESC
    LIMIT 100
  `);

  return (
    <div className="page-shell">
      <p className="section-kicker">NEWS</p>
      <h1 className="section-title mt-2">اخبار و اطلاعیه‌ها</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {items.map((item) => (
          <Link key={item.slug} href={`/news/${item.slug}`}>
            <Card className="h-full p-6">
              <span className="text-xs text-[var(--brand)]">
                <CalendarDays size={14} className="ml-1 inline" />
                {item.published_at
                  ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(item.published_at))
                  : "بدون تاریخ"}
              </span>
              <h2 className="mt-4 text-lg font-black">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {item.excerpt || "برای مشاهده جزئیات اطلاعیه وارد شوید."}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      {!items.length && <Card className="mt-8 p-10 text-center text-[var(--muted)]">اطلاعیه‌ای منتشر نشده است.</Card>}
    </div>
  );
}
