import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { className: "border-sky-500/18 bg-sky-500/8 text-sky-600", icon: Info },
  success: { className: "border-emerald-500/18 bg-emerald-500/8 text-emerald-600", icon: CheckCircle2 },
  error: { className: "border-red-500/18 bg-red-500/8 text-red-500", icon: AlertCircle },
  warning: { className: "border-amber-500/18 bg-amber-500/8 text-amber-600", icon: AlertCircle }
};

export function Alert({ tone = "info", children, className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones; children: ReactNode }) {
  const Icon = tones[tone].icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-sm font-semibold leading-6", tones[tone].className, className)} {...props}>
      <Icon className="mt-0.5 shrink-0" size={17} />
      <div>{children}</div>
    </div>
  );
}
