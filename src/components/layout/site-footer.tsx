import Link from "next/link";
import { Instagram, MapPin, Phone, Send } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export function SiteFooter() {
  return <footer className="mt-20 border-t border-[var(--line)] bg-[var(--surface)]">
    <div className="container-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
      <div><Logo /><p className="mt-5 max-w-md text-sm leading-7 text-[var(--muted)]">رزرو، قرعه‌کشی، زمان‌بندی و نمایش زنده مسابقات Coffee Game ستارخان؛ سریع، شفاف و موبایل‌محور.</p></div>
      <div><h3 className="font-black">دسترسی سریع</h3><div className="mt-4 grid gap-3 text-sm text-[var(--muted)]"><Link href="/tournaments">مسابقات پیش‌رو</Link><Link href="/live">نتایج زنده</Link><Link href="/rules">قوانین</Link><Link href="/contact">تماس با ما</Link></div></div>
      <div><h3 className="font-black">ارتباط با مجموعه</h3><div className="mt-4 grid gap-3 text-sm text-[var(--muted)]"><span className="flex items-center gap-2"><MapPin size={16}/>تهران، ستارخان</span><span className="flex items-center gap-2"><Phone size={16}/>۰۲۱-۰۰۰۰۰۰۰۰</span><div className="flex gap-2 pt-2"><span className="social"><Instagram size={18}/></span><span className="social"><Send size={18}/></span></div></div></div>
    </div>
    <div className="border-t border-[var(--line)] py-5 text-center text-xs text-[var(--muted)]">© ۱۴۰۵ Coffee Game ستارخان — نسخه MVP محلی</div>
  </footer>;
}
