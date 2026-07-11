import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="flex items-center gap-3">
    <Image src="/icons/icon-192.png" alt="Coffee Game ستارخان" width={compact ? 40 : 48} height={compact ? 40 : 48} className="rounded-2xl border border-white/10 object-cover" priority />
    {!compact && <span className="leading-tight"><strong className="block text-sm font-black tracking-wide">COFFEE GAME</strong><span className="text-xs font-bold text-[var(--brand)]">ستارخان</span></span>}
  </Link>;
}
