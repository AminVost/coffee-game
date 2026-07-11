"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  ["/tournaments", "مسابقات"], ["/live", "زنده"], ["/rankings", "رنکینگ"], ["/gallery", "گالری"], ["/rules", "قوانین"]
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return <div className="md:hidden">
    <button onClick={() => setOpen(!open)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)]">{open ? <X /> : <Menu />}</button>
    {open && <div className="absolute inset-x-4 top-[76px] z-50 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xl">
      {links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 font-bold hover:bg-[var(--surface-2)]">{label}</Link>)}
      <Link href="/login" className="mt-2 block rounded-2xl bg-[var(--brand)] px-4 py-3 text-center font-black text-white">ورود / ثبت‌نام</Link>
    </div>}
  </div>;
}
