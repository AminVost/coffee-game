import type { Metadata } from "next";
import { MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getPageContent } from "@/lib/repositories/content";

export const metadata: Metadata = { title: "تماس با ما" };
export const dynamic = "force-dynamic";

export default async function Contact() {
  const content = await getPageContent("contact");
  return <div className="page-shell"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><div><p className="section-kicker">CONTACT</p><h1 className="section-title mt-2">{content?.title || "تماس با مجموعه"}</h1><p className="mt-4 whitespace-pre-line leading-8 text-[var(--muted)]">{content?.body}</p><div className="mt-7 grid gap-4"><Card className="flex items-center gap-4 p-5"><MapPin className="text-[var(--brand)]"/><div><strong>تهران، ستارخان</strong><p className="mt-1 text-xs text-[var(--muted)]">آدرس دقیق از پنل مدیریت قابل ویرایش است.</p></div></Card><Card className="flex items-center gap-4 p-5"><Phone className="text-[var(--brand)]"/><div><strong>۰۲۱-۰۰۰۰۰۰۰۰</strong><p className="mt-1 text-xs text-[var(--muted)]">شماره واقعی را از بخش محتوا بروزرسانی کنید.</p></div></Card></div></div><Card className="p-6 sm:p-8"><h2 className="text-xl font-black">راه‌های ارتباطی</h2><p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--muted)]">{content?.body}</p></Card></div></div>;
}
