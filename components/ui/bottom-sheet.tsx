"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

// Design-system BottomSheet (docs/design-system.md §3) — the shared
// overlay/sheet structure of map/filter-sheet.tsx and ui/feedback-sheet.tsx.
// Portals to .app-shell so the sheet outranks page chrome (map z-index
// sub-scales etc.), traps focus via useDialogFocus, and closes on
// overlay click / Escape. Mount while open: `{open && <BottomSheet …/>}`.
type BottomSheetProps = {
  /** Visible sheet heading and default dialog name. */
  title: string;
  /** Contextual dialog name when the visible title alone is ambiguous. */
  ariaLabel?: string;
  /** Small `.label` line above the title (e.g. "Filters"). */
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrollable body in a bordered `.sfoot` (CTA row). */
  footer?: ReactNode;
};

export function BottomSheet({ title, ariaLabel, kicker, onClose, children, footer }: BottomSheetProps) {
  const [host, setHost] = useState<Element | null>(null);
  const titleId = useId();
  const kickerId = useId();
  // Shared focus trap: Escape, Tab cycling, and focus restoration on close.
  const dialogRef = useDialogFocus<HTMLDivElement>(Boolean(host), onClose);

  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  if (!host) return null;

  return createPortal(
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : kicker ? `${kickerId} ${titleId}` : titleId}
        tabIndex={-1}
      >
        <div className="shead">
          <div>
            {kicker && <div id={kickerId} className="label">{kicker}</div>}
            <h2 id={titleId} className="sheet-title">{title}</h2>
          </div>
          <IconButton name="x" label="Close" onClick={onClose} />
        </div>
        <div className="sbody stack">{children}</div>
        {footer && <div className="sfoot">{footer}</div>}
      </div>
    </div>,
    host,
  );
}
