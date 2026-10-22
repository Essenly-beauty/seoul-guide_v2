"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { Notice } from "@/components/ui/notice";
import { supabaseBrowser } from "@/lib/supabase/client";
import { purgeFavoritesMirror } from "@/lib/favorites";
import { purgeProfileMirror } from "@/lib/profile";
import { purgeRatingsMirror } from "@/lib/ratings";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useExitTransition } from "@/components/ui/use-exit-transition";

export function SignoutModal({ menuRow = false }: { menuRow?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), cancelRef);
  // Stay mounted while the dismissal animates out (R6).
  const { mounted, closing } = useExitTransition(open);
  const router = useRouter();
  return (
    <>
      {menuRow ? (
        <button type="button" className="inforow signout-menu-row" onClick={() => setOpen(true)}>
          <Icon name="door" size="xs" />
          <span>Sign out</span>
        </button>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)}>Sign Out</Button>
      )}
      {mounted && (
        <div
          className={closing ? "modal closing" : "modal"}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            aria-describedby="signout-description"
            tabIndex={-1}
          >
            <h3 id="signout-title" className="h3">Sign out of MYSEOULDROP?</h3>
            <p id="signout-description" className="muted small">You&apos;ll need to sign in again to access your profile and favorites.</p>
            {failed && (
              <Notice tone="warning" role="alert">
                <p>Couldn&apos;t sign out — you&apos;re still signed in on this device. Check your connection and try again.</p>
              </Notice>
            )}
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <Button buttonRef={cancelRef} variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={() => { setFailed(false); setOpen(false); }}>Cancel</Button>
              <Button
                variant="danger"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setFailed(false);
                  const { error } = await supabaseBrowser().auth.signOut().catch((cause: unknown) => ({ error: cause }));
                  setBusy(false);
                  // Offline (or the server refused) the session is still on this
                  // device and the next token refresh would bring the account
                  // back: say so instead of pretending (review 2026-10-21).
                  if (error) {
                    setFailed(true);
                    return;
                  }
                  // shared-device privacy: drop the account's local mirrors
                  purgeFavoritesMirror();
                  purgeProfileMirror();
                  purgeRatingsMirror();
                  setOpen(false);
                  router.push(routes.welcome);
                  router.refresh();
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
