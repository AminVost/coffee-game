import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-32 w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm leading-7 text-[var(--text)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[color-mix(in_srgb,var(--muted)_78%,transparent)] hover:border-[color-mix(in_srgb,var(--brand)_24%,var(--line))] focus:border-[var(--brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_13%,transparent)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});
