"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

// Design-system BottomSheet (docs/design-system.md §3) — the shared
// overlay/sheet structure of map/filter-sheet.tsx and ui/feedback-sheet.tsx.
// Portals to .app-shell so the sheet outranks page chrome (map z-index
// sub-scales etc.), traps focus via useDialogFocus, and closes on
// overlay click / Escape. Mount while open: `{open && <BottomSheet …/>}`.
type BottomSheetProps = {
  /** Sheet heading; also the dialog's accessible name. */
  title: string;
  /** Small `.label` line above the title (e.g. "Filters"). */
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrollable body in a bordered `.sfoot` (CTA row). */
  footer?: ReactNode;
};

export function BottomSheet({ title, kicker, onClose, children, footer }: BottomSheetProps) {
  const [host, setHost] = useState<Element | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Shared focus trap: Escape, Tab cycling, and focus restoration on close.
  const dialogRef = useDialogFocus<HTMLDivElement>(Boolean(host), onClose, closeRef);

  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  if (!host) return null;

  return createPortal(
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="shead">
          <div>
            {kicker && <div className="label">{kicker}</div>}
            <b>{title}</b>
          </div>
          {/* raw iconbtn kept: close control needs a ref for initial focus */}
          <button ref={closeRef} className="iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size="sm" />
          </button>
        </div>
        <div className="sbody stack">{children}</div>
        {footer && <div className="sfoot">{footer}</div>}
      </div>
    </div>,
    host,
  );
}
