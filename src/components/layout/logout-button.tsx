"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return <button onClick={logout} className={`flex w-full cursor-pointer items-center gap-2 rounded-xl text-sm font-bold text-red-500 ${compact ? "px-2 py-2" : "px-3 py-3"}`}><LogOut size={16}/>خروج</button>;
}
