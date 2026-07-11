import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--text)] shadow-[0_1px_0_rgba(255,255,255,.04)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[color-mix(in_srgb,var(--muted)_78%,transparent)] hover:border-[color-mix(in_srgb,var(--brand)_24%,var(--line))] focus:border-[var(--brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_13%,transparent)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:opacity-60 file:ml-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-[var(--brand)]",
        className
      )}
      {...props}
    />
  );
});
