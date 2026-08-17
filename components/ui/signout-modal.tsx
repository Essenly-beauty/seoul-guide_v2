"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { purgeFavoritesMirror } from "@/lib/favorites";
import { purgeProfileMirror } from "@/lib/profile";
import { purgeRatingsMirror } from "@/lib/ratings";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

export function SignoutModal({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), cancelRef);
  const router = useRouter();
  return (
    <>
      <Button variant="danger" size={compact ? "sm" : "md"} icon={compact ? "door" : undefined} onClick={() => setOpen(true)}>
        {compact ? "Sign out" : "Sign Out"}
      </Button>
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
            <h3 id="signout-title" className="h3">Sign out of MYSEOULDROP?</h3>
            <p id="signout-description" className="muted small">You&apos;ll need to sign in again to access your profile and favorites.</p>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <Button buttonRef={cancelRef} variant="secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                style={{ flex: 1 }}
                onClick={async () => {
                  await supabaseBrowser().auth.signOut();
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
