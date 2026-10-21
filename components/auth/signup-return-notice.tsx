"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthUser } from "@/lib/auth/use-auth";
import { favoritesAccount, saveFavorite, useFavoritesReady } from "@/lib/favorites";
import { routes } from "@/lib/routes";
import { claimPendingFavoriteReturn, clearPendingFavoriteReturn, favoriteSaveFailedMessage, favoriteSavedMessage } from "@/lib/signup-return";
import { useToast } from "@/components/ui/toast";

/** Saves the place a guest hearted right before joining (guests save nothing
    themselves — owner decision 2026-10-20) and shows the acknowledgement once
    the saved-place store is ready. The request is cleared only after the
    server confirms the save, only if it is still this request, and only while
    the account that asked is still signed in — a save finishing late must not
    delete a newer visitor's request or announce itself on their screen; a
    failed write keeps the request for the next screen (codex review 2026-10-20). */
export function SignupReturnNotice() {
  const pathname = usePathname();
  const { user, loading } = useAuthUser();
  const favoritesReady = useFavoritesReady();
  const { toast } = useToast();
  const saving = useRef(false);
  const signedInAs = useRef<string | null>(null);
  signedInAs.current = user?.id ?? null;

  useEffect(() => {
    if (loading || !user || !favoritesReady || pathname === routes.onboardingBasics || saving.current) return;
    // Act only for the account the favorites store holds: useAuthUser can lag
    // behind it (e.g. right after account deletion), and a claim stamped for
    // the wrong account would hide the request from the real one.
    if (favoritesAccount() !== user.id) return;
    const pending = claimPendingFavoriteReturn(user.id);
    if (!pending) return;
    const asker = user.id;
    saving.current = true;
    let onThisScreen = true;
    void saveFavorite("place", pending.placeId).then((result) => {
      saving.current = false;
      // Settled for the account that claimed it: retire it whoever is signed
      // in now (the request id keeps a newer request safe). A failed save
      // stays claimed by `asker`, so no other account ever replays it.
      if (result !== "failed") clearPendingFavoriteReturn(pending);
      if (signedInAs.current !== asker) return; // never announce on another account's screen
      if (result === "failed") {
        if (onThisScreen) toast(favoriteSaveFailedMessage(pending.placeName), 4000);
        return;
      }
      if (result === "saved") toast(favoriteSavedMessage(pending.placeName), 3000);
    });
    return () => { onThisScreen = false; };
  }, [favoritesReady, loading, pathname, toast, user]);

  return null;
}
