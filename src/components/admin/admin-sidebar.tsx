"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Contact, CopyPlus, Images, LayoutDashboard, Menu, Settings, Swords, Trophy, Users, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";
import { adminNavigation } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

const iconMap = { LayoutDashboard, Trophy, CopyPlus, Contact, Users, Swords, WalletCards, Images, Settings };

const requiredPermissionByHref: Record<string, string> = {
  "/admin": "tournaments.view",
  "/admin/tournaments": "tournaments.view",
  "/admin/templates": "templates.manage",
  "/admin/players": "players.view",
  "/admin/participants": "checkin.manage",
  "/admin/matches": "results.submit",
  "/admin/payments": "payments.view",
  "/admin/content": "content.manage",
  "/admin/settings": "settings.manage"
};

function canAccess(permissions: string[], href: string) {
  const requiredPermission = requiredPermissionByHref[href];
  return !requiredPermission || permissions.includes("*") || permissions.includes(requiredPermission);
}

export function AdminSidebar({
  permissions,
  pendingPaymentCount
}: {
  permissions: string[];
  pendingPaymentCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNavigation = adminNavigation.filter((item) => canAccess(permissions, item.href));

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} variant="secondary" size="icon" className="fixed right-4 top-4 z-50 lg:hidden" aria-label="باز کردن منوی مدیریت">
        <Menu size={19} />
      </Button>
      {open && <Button type="button" aria-label="بستن منو" onClick={() => setOpen(false)} variant="ghost" className="fixed inset-0 z-40 h-auto w-auto rounded-none bg-black/60 p-0 lg:hidden" />}
      <aside className={cn("fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between p-2">
          <Logo />
          <Button type="button" onClick={() => setOpen(false)} variant="ghost" size="iconSm" className="lg:hidden" aria-label="بستن منو"><X size={18} /></Button>
        </div>
        <div className="my-5 h-px bg-[var(--line)]" />
        <nav className="grid gap-1.5">
          {visibleNavigation.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                onClick={() => setOpen(false)}
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
                  active
                    ? "bg-[var(--brand)] text-white shadow-[0_12px_28px_color-mix(in_srgb,var(--brand)_24%,transparent)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                )}
              >
                <Icon size={19} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin/payments" && pendingPaymentCount > 0 && (
                  <span className={cn(
                    "grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-black",
                    active ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-600"
                  )}>
                    {pendingPaymentCount > 99 ? "99+" : pendingPaymentCount.toLocaleString("fa-IR")}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">منبع داده</p>
          <strong className="mt-1 block text-sm text-emerald-500">MySQL فعال</strong>
          <div className="mt-3"><LogoutButton compact /></div>
        </div>
      </aside>
    </>
  );
}
