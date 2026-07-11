import Link from "next/link";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-extrabold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand)_20%,transparent)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border border-transparent bg-[var(--brand)] text-white shadow-[0_14px_32px_color-mix(in_srgb,var(--brand)_25%,transparent)] hover:-translate-y-0.5 hover:bg-[var(--brand-strong)] hover:shadow-[0_18px_38px_color-mix(in_srgb,var(--brand)_30%,transparent)]",
        secondary:
          "border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] shadow-sm hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brand)_40%,var(--line))] hover:bg-[var(--surface-2)]",
        outline:
          "border border-[color-mix(in_srgb,var(--brand)_35%,var(--line))] bg-transparent text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_9%,transparent)]",
        soft:
          "border border-transparent bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_18%,transparent)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
        danger:
          "border border-transparent bg-red-600 text-white shadow-[0_12px_28px_rgba(220,38,38,.18)] hover:-translate-y-0.5 hover:bg-red-700",
        dangerSoft:
          "border border-red-500/15 bg-red-500/10 text-red-500 hover:bg-red-500/15"
      },
      size: {
        sm: "h-9 px-3.5 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "h-11 w-11 p-0",
        iconSm: "h-9 w-9 rounded-xl p-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

type SharedProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  loading?: boolean;
  loadingText?: string;
  asChild?: boolean;
};

type NativeButtonProps = SharedProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: never;
  };

type LinkButtonProps = SharedProps & {
  href: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  children: React.ReactNode;
  "aria-label"?: string;
};

export type ButtonProps = NativeButtonProps | LinkButtonProps;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  props,
  ref
) {
  const {
    className,
    variant,
    size,
    loading = false,
    loadingText,
    asChild = false,
    children
  } = props;

  const classes = cn(buttonVariants({ variant, size }), className);
  const content = (
    <>
      {loading && <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />}
      {loading && loadingText ? loadingText : children}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        target={props.target}
        rel={props.rel}
        aria-label={props["aria-label"]}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  if (asChild) {
    return <Slot className={classes}>{children}</Slot>;
  }

  const { href: _href, loading: _loading, loadingText: _loadingText, asChild: _asChild, ...buttonProps } = props as NativeButtonProps & { href?: never };
  void _href;
  void _loading;
  void _loadingText;
  void _asChild;

  return (
    <button
      ref={ref}
      {...buttonProps}
      disabled={loading || buttonProps.disabled}
      className={classes}
    >
      {content}
    </button>
  );
});
