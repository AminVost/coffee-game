import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Common = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
};

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type LinkProps = Common & { href: string; target?: string };

const variants = {
  primary: "bg-[var(--brand)] text-white shadow-[0_12px_30px_rgba(21,181,104,.24)] hover:bg-[var(--brand-strong)]",
  secondary: "border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--brand)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  danger: "bg-red-600 text-white hover:bg-red-700"
};
const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-5", lg: "h-13 px-7 text-base" };

export function Button(props: ButtonProps | LinkProps) {
  const { children, variant = "primary", size = "md", className } = props;
  const classes = cn("inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl font-bold transition focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 disabled:cursor-not-allowed disabled:opacity-50", variants[variant], sizes[size], className);
  if ("href" in props && props.href) {
    return <Link href={props.href} className={classes} target={props.target}>{children}</Link>;
  }
  const { href, ...buttonProps } = props as ButtonProps & { href?: never };
  void href;
  return <button {...buttonProps} className={classes}>{children}</button>;
}
