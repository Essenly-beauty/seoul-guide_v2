import type { ReactNode } from "react";

// Design-system Badge (docs/design-system.md §3) — small mono uppercase
// tag (`.badge {tone}`): D-day counts, saved counts, NEW/LIVE-adjacent meta.
type BadgeProps = {
  /** accent: brand highlight · warning: amber · info: blue · dim: quiet count */
  tone: "accent" | "warning" | "info" | "dim";
  children: ReactNode;
};

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
