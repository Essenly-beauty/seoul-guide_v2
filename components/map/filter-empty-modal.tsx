"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useExitTransition } from "@/components/ui/use-exit-transition";

/** The map went blank because the filters the visitor just applied match
 *  nothing. Say so, and offer the two ways out.
 *
 *  Owner request 2026-09-27. A blank map with a filter badge reads as "the
 *  app has nothing here", not "you filtered everything out". The modal is the
 *  same centred card as the sign-out confirmation, so it reads as a question
 *  and not as another sheet. lib/filter-empty-policy.ts decides when it may
 *  appear; this component only asks. */
export function FilterEmptyModal({
  onAdjust,
  onReset,
  onClose,
}: {
  /** Reopen the filter sheet with the current filters still set. */
  onAdjust: () => void;
  /** Clear every filter so the map shows everything again. */
  onReset: () => void;
  onClose: () => void;
}) {
  const adjustRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose, adjustRef);
  // Stay mounted while the dismissal animates out (R6 pattern).
  const { mounted, closing } = useExitTransition(true);
  if (!mounted) return null;
  return (
    <div
      className={closing ? "modal filter-empty-modal closing" : "modal filter-empty-modal"}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-empty-title"
        aria-describedby="filter-empty-description"
        tabIndex={-1}
      >
        <h3 id="filter-empty-title" className="h3">No places match these filters</h3>
        <p id="filter-empty-description" className="muted small">
          Nothing nearby fits every filter you set. Loosen them, or clear them to see everything again.
        </p>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onReset}>Clear filters</Button>
          <Button buttonRef={adjustRef} variant="primary" style={{ flex: 1 }} onClick={onAdjust}>Change filters</Button>
        </div>
      </div>
    </div>
  );
}
