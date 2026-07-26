import type { ReactNode } from "react";

// Design-system Badge (docs/design-system.md §3) — small mono uppercase
// tag (`.badge {tone}`): D-day counts, saved counts, NEW/LIVE-adjacent meta.
type BadgeProps = {
  /** accent: brand · warning: amber · info: blue · success/error: status · dim: quiet */
  tone: "accent" | "warning" | "info" | "success" | "error" | "dim";
  children: ReactNode;
};

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
