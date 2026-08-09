"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { toggleFavorite, useFavorites, type FavKind } from "@/lib/favorites";

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
  return (
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
        const next = kind && id ? toggleFavorite(kind, id) : !on;
        if (!(kind && id)) setLocalOn(next);
        toast(next ? "Saved to favorites" : "Removed");
      }}
    />
  );
}
