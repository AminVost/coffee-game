import type { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";
import { env } from "@/lib/env";

type PageContentRow = RowDataPacket & {
  slug: string;
  title: string;
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  is_published: number;
};

const fallback: Record<string, { slug: string; title: string; body: string; seoTitle: string; seoDescription: string }> = {
  home: { slug: "home", title: "صفحه اصلی", body: "سامانه رسمی مسابقات FC 26 و تخته‌نرد Coffee Game ستارخان؛ ثبت‌نام، پرداخت، قرعه‌کشی، برنامه بازی و نتایج زنده، همه در موبایل.", seoTitle: "Coffee Game ستارخان", seoDescription: "رزرو مسابقات" },
  rules: { slug: "rules", title: "قوانین مجموعه و مسابقات", body: "هر شماره موبایل در هر مسابقه فقط یک بار قابل ثبت است.\nرزرو تا زمان تعیین‌شده برای پرداخت معتبر است.\nثبت حضور با QR یا به‌صورت دستی انجام می‌شود.\nنتیجه توسط داور یا مدیر ثبت می‌شود.", seoTitle: "قوانین مسابقات", seoDescription: "قوانین مجموعه" },
  about: { slug: "about", title: "Coffee Game ستارخان", body: "یک فضای بازی و رقابت برای دوستداران FC و تخته‌نرد. هدف این سامانه، ساده‌کردن رزرو، قرعه‌کشی، مدیریت زمان و نمایش شفاف نتایج است.", seoTitle: "درباره ما", seoDescription: "معرفی مجموعه" },
  contact: { slug: "contact", title: "تماس با مجموعه", body: "تهران، ستارخان\nشماره تماس و راه‌های ارتباطی مجموعه از پنل مدیریت قابل بروزرسانی است.", seoTitle: "تماس با ما", seoDescription: "راه‌های ارتباطی" }
};

export async function getPageContent(slug: string) {
  if (env.dataMode === "mock") return fallback[slug] || null;
  const rows = await queryRows<PageContentRow[]>(`
    SELECT slug,title,body,seo_title,seo_description,is_published
    FROM page_contents WHERE slug=? AND is_published=1 LIMIT 1
  `, [slug]);
  const row = rows[0];
  if (!row) return fallback[slug] || null;
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    seoTitle: row.seo_title || row.title,
    seoDescription: row.seo_description || ""
  };
}
