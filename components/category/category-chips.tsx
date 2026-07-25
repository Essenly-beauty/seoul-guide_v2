"use client";

import { CategoryBadge } from "./category-badge";
import { Chip } from "@/components/ui/chip";
import { MAP_CATEGORIES, type PlaceType } from "@/lib/data";

export type MapCat = "all" | PlaceType;

/** Single-select category chip rail (spec v2 §4.1-2).
    Chips never shrink; the rail scrolls with a right fade hinting at overflow. */
export function CategoryChips({ value, onChange, className, style }: {
  value: MapCat;
  onChange: (cat: MapCat) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={["chiprow", "faded", className].filter(Boolean).join(" ")} role="group" aria-label="Filter by category" style={style}>
      {MAP_CATEGORIES.map((c) => (
        <Chip
          key={c.key}
          selected={value === c.key}
          onClick={() => onChange(c.key)}
        >
          {c.key !== "all" && <CategoryBadge type={c.key as PlaceType} size={16} />}
          {c.label}
        </Chip>
      ))}
    </div>
  );
}
