"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="dangerSoft"
      size={compact ? "sm" : "md"}
      className="w-full justify-start"
      onClick={logout}
      loading={loading}
      loadingText="در حال خروج..."
    >
      <LogOut size={16} />
      خروج
    </Button>
  );
}
