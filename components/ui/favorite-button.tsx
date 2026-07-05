"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";

type FavoriteButtonProps = {
  initial?: boolean;
  /** iconbtn variant classes (e.g. "bordered"). */
  variant?: string;
  size?: "sm" | "xs";
};

export function FavoriteButton({ initial = false, variant = "", size = "sm" }: FavoriteButtonProps) {
  const [on, setOn] = useState(initial);
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
        const next = !on;
        setOn(next);
        toast(next ? "Saved to favorites" : "Removed");
      }}
    >
      <Icon name={on ? "heart" : "heart-o"} size={size} />
    </button>
  );
}
