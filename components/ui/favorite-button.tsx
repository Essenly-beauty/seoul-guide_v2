"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { toggleFavorite, useFavorites, type FavKind } from "@/lib/favorites";

type FavoriteButtonProps = {
  /** Wire to the shared store — hearts sync across screens and the Saved tab. */
  kind?: FavKind;
  id?: string;
  /** Fallback initial state when no kind/id is given (detached prototype button). */
  initial?: boolean;
  /** iconbtn variant classes (e.g. "soft"). */
  variant?: string;
  size?: "sm" | "xs";
};

export function FavoriteButton({ kind, id, initial = false, variant = "", size = "sm" }: FavoriteButtonProps) {
  const favs = useFavorites();
  const [localOn, setLocalOn] = useState(initial);
  const stored = kind && id ? favs[kind].includes(id) : undefined;
  const on = stored ?? localOn;
  const { toast } = useToast();
  return (
    <button
      className={["iconbtn", variant].filter(Boolean).join(" ")}
      aria-pressed={on}
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      style={{ color: on ? "var(--accent)" : undefined }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = kind && id ? toggleFavorite(kind, id) : !on;
        if (!(kind && id)) setLocalOn(next);
        toast(next ? "Saved to favorites" : "Removed");
      }}
    >
      <Icon name={on ? "heart" : "heart-o"} size={size} />
    </button>
  );
}
