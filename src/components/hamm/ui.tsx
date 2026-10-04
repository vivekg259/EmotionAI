import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5 md:p-6", className)}>
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ink" | "ghost" | "quiet";
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-primary text-primary-fg",
    ink: "bg-fg text-bg",
    ghost: "border border-border bg-surface text-fg",
    quiet: "bg-transparent text-muted",
  }[variant];
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function formatPoints(points: number) {
  const sign = points > 0 ? "+" : "";
  return `${sign}${String(points).padStart(2, "0")}`;
}
