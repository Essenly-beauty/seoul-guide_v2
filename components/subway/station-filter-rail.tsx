"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { SubwayPlaceCategory } from "./subway-route-controller";

export const SUBWAY_CATEGORY_OPTIONS: { key: SubwayPlaceCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "beauty", label: "Beauty" },
  { key: "olive_young", label: "Olive Young" },
  { key: "personal_color", label: "Personal Color" },
  { key: "mall", label: "Mall & Gifts" },
  { key: "daiso", label: "Daiso" },
];

export function radiusLabel(radiusKm: number) {
  return radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`;
}

/** Radius + category filters for the station browse. It lives on the map with
    the other map chrome rather than inside the panel (owner decision
    2026-08-22): the panel is for results, and a filter row there cost a shop
    row on every snap. The rail itself never scrolls — an overflow container
    would clip the radius popover — only the category strip does. */
export function StationFilterRail({ radiusKm, category, onRadius, onCategory }: {
  radiusKm: number;
  category: SubwayPlaceCategory;
  onRadius: (radiusKm: number) => void;
  onCategory: (category: SubwayPlaceCategory) => void;
}) {
  const [radiusOpen, setRadiusOpen] = useState(false);
  return (
    <div className="station-filter-rail" role="group" aria-label="Filter nearby places">
      <div className="station-sheet-radius">
        <button
          type="button"
          className={`sfchip${radiusOpen || radiusKm !== 0.5 ? " on" : ""}`}
          aria-expanded={radiusOpen}
          aria-haspopup="true"
          onClick={() => setRadiusOpen((v) => !v)}
        >
          {radiusLabel(radiusKm)}
          <Icon name="chev" size="xs" style={{ transform: "rotate(90deg)" }} />
        </button>
        {radiusOpen && (
          <div className="station-sheet-pop" role="menu">
            {[0.5, 1, 2].map((r) => (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={radiusKm === r}
                onClick={() => { onRadius(r); setRadiusOpen(false); }}
              >
                {radiusLabel(r)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="station-sheet-cats">
        {SUBWAY_CATEGORY_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`sfchip${category === option.key ? " on" : ""}`}
            aria-pressed={category === option.key}
            onClick={() => onCategory(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
