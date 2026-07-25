"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useToast } from "@/components/ui/toast";

export function CancelBookingButton() {
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), keepRef);
  const { toast } = useToast();

  const confirm = () => {
    setOpen(false);
    toast("Demo only — cancellation is not connected yet.");
  };

  return (
    <>
      <Button variant="danger" style={{ flex: 1 }} onClick={() => setOpen(true)}>
        Cancel
      </Button>
      {open && (
        <div className="modal" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            className="box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            aria-describedby="cancel-booking-description"
            tabIndex={-1}
          >
            <h3 id="cancel-booking-title" className="h3">Cancel this booking?</h3>
            <p id="cancel-booking-description" className="muted small" style={{ marginTop: 8 }}>
              HOSU DOSAN · Mon, May 4 at 14:00
            </p>
            <div className="card stack sm" style={{ marginTop: 14 }}>
              <div className="kv">
                <span className="k">Refund</span>
                <b className="v">₩45,000</b>
              </div>
              <p className="caption muted">Full refund to your original payment method. This action cannot be undone.</p>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              {/* Raw button (not <Button>): the dialog focus trap needs this ref. `secondary` replaces the deprecated `ghost` alias (same styles). */}
              <button ref={keepRef} type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}>
                Keep booking
              </button>
              <Button variant="danger" style={{ flex: 1 }} onClick={confirm}>
                Cancel booking
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
