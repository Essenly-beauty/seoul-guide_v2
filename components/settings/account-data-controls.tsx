"use client";

// Data & privacy controls (settings): export everything as JSON, or delete
// the account permanently. Delete = confirm modal -> POST /api/account/delete
// -> purge local mirrors -> home. Guests see a sign-in nudge instead.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useAuthUser } from "@/lib/auth/use-auth";
import { purgeFavoritesMirror } from "@/lib/favorites";
import { purgeProfileMirror } from "@/lib/profile";
import { purgeRatingsMirror } from "@/lib/ratings";
import { routes } from "@/lib/routes";

export function AccountDataControls() {
  const { user, loading } = useAuthUser();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => !busy && setOpen(false), cancelRef);

  if (loading) return null;
  if (!user) {
    return <p className="t-caption">Sign in to download your data or delete your account.</p>;
  }

  const deleteAccount = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast(body?.error ?? "Could not delete the account — try again.");
        setBusy(false);
        return;
      }
      // account is gone — remove every local trace before leaving
      purgeFavoritesMirror();
      purgeProfileMirror();
      purgeRatingsMirror();
      setOpen(false);
      toast("Your account and data were deleted.");
      router.push(routes.welcome);
      router.refresh();
    } catch {
      toast("Network error — your account was not deleted.");
      setBusy(false);
    }
  };

  return (
    <>
      <p className="t-caption">Download a copy of everything tied to your account, or delete it permanently.</p>
      <div className="row" style={{ gap: 10 }}>
        <Button variant="secondary" size="sm" href="/api/account/export" external style={{ flex: 1 }}>
          Download my data
        </Button>
        <Button variant="danger" size="sm" style={{ flex: 1 }} onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div
            ref={dialogRef}
            className="box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            tabIndex={-1}
          >
            <h3 id="delete-account-title" className="h3">Delete your account?</h3>
            <p id="delete-account-description" className="muted small">
              This permanently removes your account, beauty profile, saved places,
              and ratings. It cannot be undone. You can download your data first.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <Button buttonRef={cancelRef} variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" style={{ flex: 1 }} disabled={busy} onClick={deleteAccount}>
                {busy ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
