"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

export function SignoutModal() {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), cancelRef);
  const router = useRouter();
  return (
    <>
      <button type="button" className="btn danger" onClick={() => setOpen(true)}>Sign Out</button>
      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            className="box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            aria-describedby="signout-description"
            tabIndex={-1}
          >
            <h3 id="signout-title" className="h3">Sign out of Essenly?</h3>
            <p id="signout-description" className="muted small">You&apos;ll need to sign in again to access your profile and favorites.</p>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <button ref={cancelRef} type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn danger"
                style={{ flex: 1 }}
                onClick={() => {
                  setOpen(false);
                  router.push(routes.splash);
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
