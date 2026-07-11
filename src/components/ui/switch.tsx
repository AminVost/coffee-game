"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[var(--surface-3)] p-0.5 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand)_15%,transparent)] data-[state=checked]:bg-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-5.5 w-5.5 rounded-full bg-white shadow-md transition-transform data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  );
});
