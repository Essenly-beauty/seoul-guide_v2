import type React from "react";
import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from "react";

// Design-system Chip (docs/design-system.md §3) — single-select filters,
// toggles, and quiet tags. Interactive when onClick is given.
type ChipProps = {
  selected?: boolean;
  /** soft: brand-tinted selected state · mono: tabular glyph content (₩ etc.) */
  soft?: boolean;
  mono?: boolean;
  onClick?: MouseEventHandler;
  /** Native button ref for focus management; ignored by static chip spans. */
  buttonRef?: Ref<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Tablist/roving-focus escape hatch: role, id, tabIndex, onKeyDown, aria-*. */
} & Pick<React.ButtonHTMLAttributes<HTMLButtonElement>,
  "role" | "id" | "tabIndex" | "onKeyDown" | "aria-label" | "aria-checked" | "aria-expanded" | "aria-haspopup" | "aria-describedby" | "aria-selected" | "aria-controls">;

export function Chip({ selected, soft, mono, onClick, buttonRef, className, style, children, ...rest }: ChipProps) {
  const cls = ["chip", soft ? "soft" : "", mono ? "mono" : "", selected ? "selected" : "", className]
    .filter(Boolean)
    .join(" ");
  if (!onClick) {
    return <span className={cls} style={style} {...rest}>{children}</span>;
  }
  // aria-pressed only when not acting as a tab (tabs use aria-selected instead)
  const pressed = rest.role === "tab" || rest.role === "radio" ? undefined : selected;
  return (
    <button ref={buttonRef} type="button" className={cls} style={style} aria-pressed={pressed} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

const STATUS_LABEL = { confirmed: "Confirmed", pending: "Reschedule pending", cancelled: "Cancelled", completed: "Completed" } as const;

export function StatusChip({ status, children }: { status: keyof typeof STATUS_LABEL; children?: ReactNode }) {
  return <span className={`statuschip ${status}`}>{children ?? STATUS_LABEL[status]}</span>;
}
