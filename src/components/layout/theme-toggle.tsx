"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label="تغییر حالت نمایش"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="block dark:hidden" size={18} />
      <Sun className="hidden dark:block" size={18} />
    </Button>
  );
}
