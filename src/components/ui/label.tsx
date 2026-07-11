import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn("grid gap-2 text-sm font-extrabold text-[var(--text)]", className)}
        {...props}
      />
    );
  }
);

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-xs font-normal leading-6 text-[var(--muted)]", className)} {...props} />;
}
