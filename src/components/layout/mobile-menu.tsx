"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const links = [
  ["/tournaments", "مسابقات"],
  ["/live", "نتایج زنده"],
  ["/rankings", "رنکینگ"],
  ["/gallery", "گالری"],
  ["/about", "درباره ما"],
  ["/login", "ورود / ثبت‌نام"]
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button type="button" variant="secondary" size="icon" onClick={() => setOpen((value) => !value)} aria-label={open ? "بستن منو" : "باز کردن منو"}>
        {open ? <X size={19} /> : <Menu size={19} />}
      </Button>
      {open && (
        <div className="absolute inset-x-3 top-[76px] z-50 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-float)]">
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-bold hover:bg-[var(--surface-2)]">
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
