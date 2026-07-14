import type { Metadata } from "next";
import { MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getPageContent } from "@/lib/repositories/content";
import { getClubPublicSettings } from "@/lib/repositories/club";

export const metadata: Metadata = { title: "تماس با ما" };
export const dynamic = "force-dynamic";

export default async function Contact() {
  const [content, club] = await Promise.all([
    getPageContent("contact"),
    getClubPublicSettings()
  ]);

  return <div className="page-shell">
    <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <p className="section-kicker">CONTACT</p>
        <h1 className="section-title mt-2">{content?.title || "تماس با مجموعه"}</h1>
        {content?.body && <p className="mt-4 whitespace-pre-line leading-8 text-[var(--muted)]">{content.body}</p>}
        <div className="mt-7 grid gap-4">
          <Card className="flex items-center gap-4 p-5">
            <MapPin className="shrink-0 text-[var(--brand)]" />
            <div>
              <strong>{club.address || "آدرس ثبت نشده است"}</strong>
              <p className="mt-1 text-xs text-[var(--muted)]">آدرس از تنظیمات مدیریت خوانده می‌شود.</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <Phone className="shrink-0 text-[var(--brand)]" />
            <div>
              {club.phone
                ? <a href={`tel:${club.phone}`} className="font-black" dir="ltr">{club.phone}</a>
                : <strong>شماره تماس ثبت نشده است</strong>}
              <p className="mt-1 text-xs text-[var(--muted)]">شماره تماس از تنظیمات مدیریت خوانده می‌شود.</p>
            </div>
          </Card>
        </div>
      </div>
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-black">راه‌های ارتباطی</h2>
        <div className="mt-5 grid gap-4 text-sm leading-8 text-[var(--muted)]">
          {club.name && <p><strong className="text-[var(--text)]">نام مجموعه:</strong> {club.name}</p>}
          {club.address && <p><strong className="text-[var(--text)]">آدرس:</strong> {club.address}</p>}
          {club.phone && <p><strong className="text-[var(--text)]">تلفن:</strong> <span dir="ltr">{club.phone}</span></p>}
          {!club.address && !club.phone && <p>اطلاعات تماس هنوز در پنل مدیریت تکمیل نشده است.</p>}
        </div>
      </Card>
    </div>
  </div>;
}
