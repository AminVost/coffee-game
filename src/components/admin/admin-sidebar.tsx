"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Contact, CopyPlus, Images, LayoutDashboard, Menu, Settings, Swords, Trophy, Users, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import { adminNavigation } from "@/data/mock-data";
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

export function AdminSidebar({ permissions, dataMode }: { permissions: string[]; dataMode: "mock" | "mysql" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNavigation = adminNavigation.filter((item) => canAccess(permissions, item.href));

  return <>
    <button onClick={() => setOpen(true)} className="fixed right-4 top-4 z-50 grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] lg:hidden"><Menu/></button>
    {open && <button aria-label="بستن منو" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden"/>}
    <aside className={cn("fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-[var(--line)] bg-[var(--surface)] p-4 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0", open ? "translate-x-0" : "translate-x-full")}>
      <div className="flex items-center justify-between p-2"><Logo/><button onClick={()=>setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl lg:hidden"><X/></button></div>
      <div className="my-5 h-px bg-[var(--line)]"/>
      <nav className="grid gap-1.5">{visibleNavigation.map((item)=>{const Icon=iconMap[item.icon as keyof typeof iconMap];const active=item.href==="/admin"?pathname==="/admin":pathname.startsWith(item.href);return <Link onClick={()=>setOpen(false)} key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",active?"bg-[var(--brand)] text-white shadow-lg":"text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]")}><Icon size={19}/>{item.label}</Link>})}</nav>
      <div className="mt-auto rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-xs text-[var(--muted)]">حالت داده</p><strong className={cn("mt-1 block text-sm", dataMode === "mysql" ? "text-emerald-500" : "text-amber-500")}>{dataMode === "mysql" ? "MySQL متصل" : "Mock محلی"}</strong><div className="mt-2"><LogoutButton compact /></div></div>
    </aside>
  </>;
}
