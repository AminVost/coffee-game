import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { getClubPublicSettings } from "@/lib/repositories/club";

export async function SiteFooter() {
  const club = await getClubPublicSettings();
  const currentYear = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

  return <footer className="mt-20 border-t border-[var(--line)] bg-[var(--surface)]">
    <div className="container-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <Logo />
        <p className="mt-5 max-w-md text-sm leading-7 text-[var(--muted)]">
          رزرو، قرعه‌کشی، زمان‌بندی و نمایش زنده مسابقات {club.name || "Coffee Game"}؛ سریع، شفاف و موبایل‌محور.
        </p>
      </div>
      <div>
        <h3 className="font-black">دسترسی سریع</h3>
        <div className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
          <Link href="/tournaments">مسابقات پیش‌رو</Link>
          <Link href="/live">نتایج زنده</Link>
          <Link href="/rules">قوانین</Link>
          <Link href="/contact">تماس با ما</Link>
        </div>
      </div>
      <div>
        <h3 className="font-black">ارتباط با مجموعه</h3>
        <div className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
          {club.address && <span className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0" size={16} />{club.address}</span>}
          {club.phone && <a className="flex items-center gap-2" href={`tel:${club.phone}`} dir="ltr"><Phone size={16} />{club.phone}</a>}
          {!club.address && !club.phone && <span>اطلاعات تماس از پنل مدیریت تکمیل می‌شود.</span>}
        </div>
      </div>
    </div>
    <div className="border-t border-[var(--line)] py-5 text-center text-xs text-[var(--muted)]">
      © {currentYear} {club.name || "Coffee Game"}
    </div>
  </footer>;
}
