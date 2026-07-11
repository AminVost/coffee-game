import Link from "next/link";
import { Bell, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileMenu } from "@/components/layout/mobile-menu";

const links = [
  ["/tournaments", "مسابقات"], ["/live", "نتایج زنده"], ["/rankings", "رنکینگ"], ["/gallery", "گالری"], ["/about", "درباره ما"]
];

export async function SiteHeader() {
  const session = await getSession();
  return <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-xl">
    <div className="container-shell flex h-[72px] items-center justify-between gap-4">
      <Logo />
      <nav className="hidden items-center gap-1 md:flex">
        {links.map(([href, label]) => <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-bold text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]">{label}</Link>)}
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {session ? <>
          <Link href="/account/notifications" className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"><Bell size={18} /></Link>
          <Link href={session.role === "admin" ? "/admin" : "/account"} className="hidden h-10 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-black text-white sm:flex"><UserRound size={17} />{session.name}</Link>
        </> : <Link href="/login" className="hidden h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-black text-white sm:flex">ورود / ثبت‌نام</Link>}
        <MobileMenu />
      </div>
    </div>
  </header>;
}
