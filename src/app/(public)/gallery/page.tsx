import type { Metadata } from "next";
import type { RowDataPacket } from "mysql2";
import { Card } from "@/components/ui/card";
import { queryRows } from "@/lib/db";

export const metadata: Metadata = { title: "گالری" };
export const dynamic = "force-dynamic";

type GalleryRow = RowDataPacket & {
  id: number;
  title: string | null;
  image_url: string;
  category: string | null;
};

export default async function Gallery() {
  const images = await queryRows<GalleryRow[]>(`
    SELECT id,title,image_url,category
    FROM gallery_items
    WHERE is_published=1
    ORDER BY sort_order ASC,created_at DESC,id DESC
    LIMIT 200
  `);

  return (
    <div className="page-shell">
      <p className="section-kicker">GALLERY</p>
      <h1 className="section-title mt-2">گالری مسابقات و قهرمانان</h1>
      <div className="mt-8 grid auto-rows-[220px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((item, index) => (
          <div
            key={item.id}
            className={`relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] ${index % 7 === 2 ? "sm:row-span-2" : ""}`}
          >
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${item.image_url})` }} />
            {(item.title || item.category) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
                {item.title && <strong>{item.title}</strong>}
                {item.category && <span className="mt-1 block text-xs text-white/70">{item.category}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      {!images.length && <Card className="mt-8 p-10 text-center text-[var(--muted)]">تصویری منتشر نشده است.</Card>}
    </div>
  );
}
