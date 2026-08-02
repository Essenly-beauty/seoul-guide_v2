"use client";

import { CategoryBadge } from "./category-badge";
import { Chip } from "@/components/ui/chip";
import { MAP_CATEGORIES, type PlaceType } from "@/lib/data";

export type MapCat = "all" | PlaceType;

/** Multi-select category chip rail (user decision 2026-08-02) — categories
    toggle independently; "All" clears the selection. Chips never shrink; the
    rail scrolls with a right fade hinting at overflow. */
export function CategoryChips({ selected, onToggle, onClear, className, style }: {
  selected: readonly PlaceType[];
  onToggle: (cat: PlaceType) => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={["chiprow", "faded", className].filter(Boolean).join(" ")} role="group" aria-label="Filter by category" style={style}>
      {MAP_CATEGORIES.map((c) => (
        <Chip
          key={c.key}
          selected={c.key === "all" ? selected.length === 0 : selected.includes(c.key as PlaceType)}
          onClick={() => (c.key === "all" ? onClear() : onToggle(c.key as PlaceType))}
        >
          {c.key !== "all" && <CategoryBadge type={c.key as PlaceType} size={16} />}
          {c.label}
        </Chip>
      ))}
    </div>
  );
}
