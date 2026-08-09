import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";

// Design-system Notice (docs/design-system.md §3) — inline `.banner {tone}`
// message: place-detail medical warning, map location-fallback banner.
// Dismissal state stays with the caller (`{show && <Notice onDismiss …/>}`).
type NoticeProps = {
  /** info: blue-soft (default) · warning: amber-soft · accent: brand-soft */
  tone?: "info" | "warning" | "accent";
  /** Optional leading glyph (e.g. "cross" for the medical warning). */
  icon?: IconName;
  /** Shows a trailing dismiss IconButton (map-banner pattern). */
  onDismiss?: () => void;
  /** Add a live-region role only when the message appears dynamically. */
  role?: "status" | "alert";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function Notice({ tone = "info", icon, onDismiss, role, className, style, children }: NoticeProps) {
  const cls = ["banner", tone, className].filter(Boolean).join(" ");
  return (
    <div className={cls} role={role} style={style}>
      {icon && <Icon name={icon} size="sm" />}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {onDismiss && (
        <IconButton
          name="x"
          label="Dismiss"
          iconSize="xs"
          onClick={onDismiss}
          // Pull the 44px target into the banner padding without shrinking it.
          style={{ flex: "none", margin: "-6px -6px -6px 0", color: "inherit" }}
        />
      )}
    </div>
  );
}
