import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";

type PageContentRow = RowDataPacket & {
  slug: string;
  title: string;
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  is_published: number;
};

export async function getPageContent(slug: string) {
  const rows = await queryRows<PageContentRow[]>(`
    SELECT slug,title,body,seo_title,seo_description,is_published
    FROM page_contents WHERE slug=? AND is_published=1 LIMIT 1
  `, [slug]);
  const row = rows[0];
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    seoTitle: row.seo_title || row.title,
    seoDescription: row.seo_description || ""
  };
}
