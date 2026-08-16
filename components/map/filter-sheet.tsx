"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/category/category-badge";
import { Chip } from "@/components/ui/chip";
import { PRICE_OPTIONS, SERVICE_FILTERS, TYPE_LABEL, type PlaceType, type PriceRange } from "@/lib/data";
import { EMPTY_FILTERS, type MapFilters } from "@/lib/places";

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function FilterSheet({ cats, filters, onApply, onClose }: {
  /** Selected category chips — empty means all categories. */
  cats: readonly PlaceType[];
  filters: MapFilters;
  onApply: (f: MapFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MapFilters>(filters);
  // With category chips selected, show those categories' tag groups; with
  // none, show every group — the filter badge counts tags even when no
  // category is picked, so the sheet must expose them all (2026-08-02).
  const serviceGroups = (cats.length > 0 ? cats : (Object.keys(SERVICE_FILTERS) as PlaceType[]))
    .map((c) => ({ type: c, tags: SERVICE_FILTERS[c] ?? [] }))
    .filter((g) => g.tags.length > 0);

  const DISTANCES: { km: number; label: string }[] = [
    { km: 0.5, label: "500 m" },
    { km: 1, label: "1 km" },
    { km: 3, label: "3 km" },
  ];

  return (
    <BottomSheet
      title={cats.length === 0 ? "All categories" : cats.map((c) => TYPE_LABEL[c]).join(" · ")}
      kicker="Filters"
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 8 }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={() => setDraft(EMPTY_FILTERS)}>Reset</Button>
          <Button style={{ flex: 2 }} onClick={() => { onApply(draft); onClose(); }}>Apply filters</Button>
        </div>
      }
    >
      <div className="filtersheet stack">
      <div>
        <div className="label">Rating & options</div>
        <div className="chipwrap" style={{ marginTop: 6 }}>
          <Chip selected={draft.minRating4} onClick={() => setDraft({ ...draft, minRating4: !draft.minRating4 })}>★ 4.0+</Chip>
          <Chip selected={draft.englishOnly} onClick={() => setDraft({ ...draft, englishOnly: !draft.englishOnly })}>English OK</Chip>
          <Chip selected={draft.bookableOnly} onClick={() => setDraft({ ...draft, bookableOnly: !draft.bookableOnly })}>Bookable</Chip>
        </div>
      </div>
      <div>
        <div className="label">Price</div>
        <div className="chipwrap" style={{ marginTop: 6 }}>
          {PRICE_OPTIONS.map((p: PriceRange) => (
            <Chip key={p} mono selected={draft.prices.includes(p)} onClick={() => setDraft({ ...draft, prices: toggle(draft.prices, p) })}>{p}</Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="label">Distance from me</div>
        <div className="chipwrap" style={{ marginTop: 6 }}>
          {DISTANCES.map((d) => (
            <Chip
              key={d.km}
              mono
              selected={draft.maxKm === d.km}
              onClick={() => setDraft({ ...draft, maxKm: draft.maxKm === d.km ? null : d.km })}
            >
              {d.label}
            </Chip>
          ))}
        </div>
      </div>
      {serviceGroups.map((g) => (
        <div key={g.type} className="filtergroup">
          <div className="filtergroup-head">
            <CategoryBadge type={g.type} size={15} />
            <span>{TYPE_LABEL[g.type]}</span>
          </div>
          <div className="chipwrap" style={{ marginTop: 8 }}>
            {g.tags.map((s) => (
              <Chip key={s.key} selected={draft.serviceTags.includes(s.key)} onClick={() => setDraft({ ...draft, serviceTags: toggle(draft.serviceTags, s.key) })}>{s.label}</Chip>
            ))}
          </div>
        </div>
      ))}
      </div>
    </BottomSheet>
  );
}
