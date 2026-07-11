import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { SessionUser } from "@/lib/auth";

export function AdminHeader({ user }: { user: SessionUser }) {
  return <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-[var(--line)] bg-[var(--bg)]/85 px-4 backdrop-blur-xl sm:px-7">
    <div className="mr-14 lg:mr-0">
      <p className="text-xs text-[var(--muted)]">پنل مدیریت</p>
      <strong className="text-sm">سلام، {user.name}</strong>
    </div>
    <ThemeToggle/>
  </header>;
}
