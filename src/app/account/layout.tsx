import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CreditCard, Home, ShieldCheck, Trophy, Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { LogoutButton } from "@/components/layout/logout-button";
import { getSession } from "@/lib/auth";
const links=[["/account","داشبورد",Home],["/account/tournaments","مسابقات من",Trophy],["/account/teams","تیم‌های من",Users],["/account/payments","پرداخت‌ها",CreditCard],["/account/notifications","اعلان‌ها",Bell],["/account/security","امنیت",ShieldCheck]] as const;
export default async function AccountLayout({children}:{children:React.ReactNode}){const user=await getSession();if(!user)redirect("/login");return <><SiteHeader/><main className="page-shell"><div className="grid gap-6 lg:grid-cols-[230px_1fr]"><aside className="h-fit rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-3 lg:sticky lg:top-24"><div className="p-3"><strong>{user.name}</strong><p className="mt-1 text-xs text-[var(--muted)]">حساب کاربری</p></div><div className="my-2 h-px bg-[var(--line)]"/>{links.map(([href,label,Icon])=><Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><Icon size={17}/>{label}</Link>)}<div className="mt-2"><LogoutButton /></div></aside><section className="min-w-0">{children}</section></div></main></>}
