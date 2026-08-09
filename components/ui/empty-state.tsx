import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";

// Design-system EmptyState (docs/design-system.md §3) — dashed `.empty`
// card for zero-result lists ("Nothing saved yet — tap ♥ on any place.").
type EmptyStateProps = {
  /** Optional accent-soft icon circle above the message (`.empty .ic`). */
  icon?: IconName;
  children: ReactNode;
  /** Optional CTA below the message (e.g. <Button size="sm">). */
  action?: ReactNode;
};

export function EmptyState({ icon, children, action }: EmptyStateProps) {
  return (
    <div className="empty">
      {icon && <span className="ic"><Icon name={icon} size="sm" /></span>}
      <p>{children}</p>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
