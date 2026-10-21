"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { useSigninNudge } from "@/components/auth/signin-nudge";
import { toggleFavorite, useFavorites, type FavKind } from "@/lib/favorites";
import { recordValueMoment } from "@/lib/install-nudge";
import { getPlace } from "@/lib/data";
import { useAuthUser } from "@/lib/auth/use-auth";

type FavoriteButtonProps = {
  /** Wire to the shared store — hearts sync across screens and the Saved tab. */
  kind?: FavKind;
  id?: string;
  /** Fallback initial state when no kind/id is given (detached prototype button). */
  initial?: boolean;
  /** Legacy bordered maps to the design-system overlay treatment. */
  variant?: "plain" | "soft" | "bordered";
  size?: "sm" | "xs";
};

export function FavoriteButton({ kind, id, initial = false, variant = "plain", size = "sm" }: FavoriteButtonProps) {
  const favs = useFavorites();
  const [localOn, setLocalOn] = useState(initial);
  const stored = kind && id ? favs[kind].includes(id) : undefined;
  const on = stored ?? localOn;
  const { toast } = useToast();
  const { nudge, sheet } = useSigninNudge();
  const { user, loading } = useAuthUser();
  return (
    <>
      <IconButton
        name={on ? "heart" : "heart-o"}
        label={on ? "Remove from favorites" : "Add to favorites"}
        variant={variant === "bordered" ? "overlay" : variant}
        pressed={on}
        iconSize={size}
        style={{ color: on ? "var(--accent)" : undefined }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const place = kind === "place" && id ? getPlace(id) : null;
          // Guests save nothing (owner decision 2026-10-20): the join sheet
          // remembers the place and saves it once they return signed in.
          if (!user) {
            if (!loading) nudge("favorite", place ? { savedPlace: { id: place.id, name: place.name } } : undefined);
            return;
          }
          const next = kind && id ? toggleFavorite(kind, id) : !on;
          if (!(kind && id)) setLocalOn(next);
          toast(next ? "Saved to favorites" : "Removed");
          // Saving is the moment the app has proved useful, so it is also when
          // the Home Screen offer becomes fair to make. Counted, not shown:
          // lib/install-nudge-policy.ts decides whether it appears.
          if (next) recordValueMoment();
        }}
      />
      {sheet}
    </>
  );
}
