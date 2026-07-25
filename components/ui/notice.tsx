import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";

// Design-system Notice (docs/design-system.md §3) — inline `.banner {tone}`
// message: place-detail medical warning, map location-fallback banner.
// Dismissal state stays with the caller (`{show && <Notice onDismiss …/>}`).
type NoticeProps = {
  /** info: blue-soft (default) · warning: amber-soft */
  tone?: "info" | "warning";
  /** Optional leading glyph (e.g. "cross" for the medical warning). */
  icon?: IconName;
  /** Shows a trailing dismiss IconButton (map-banner pattern). */
  onDismiss?: () => void;
  children: ReactNode;
};

export function Notice({ tone = "info", icon, onDismiss, children }: NoticeProps) {
  return (
    <div className={`banner ${tone}`} role="status">
      {icon && <Icon name={icon} size="sm" />}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {onDismiss && (
        <IconButton
          name="x"
          label="Dismiss"
          size={28}
          iconSize="xs"
          onClick={onDismiss}
          // pull the 28px hit area back into the banner's 12px padding
          style={{ flex: "none", margin: "-6px -6px -6px 0", color: "inherit" }}
        />
      )}
    </div>
  );
}
