"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
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
  // Multi-select chips: offer the union of the selected categories' tags.
  const services = cats.length > 0
    ? cats.flatMap((c) => SERVICE_FILTERS[c] ?? [])
    : undefined;

  return (
    <BottomSheet
      title={cats.length === 0 ? "All categories" : cats.map((c) => TYPE_LABEL[c]).join(" · ")}
      kicker="Filters"
      onClose={onClose}
    >
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
      {services && services.length > 0 && (
        <div>
          <div className="label">{cats.length === 1 ? `${TYPE_LABEL[cats[0]]} services` : "Services"}</div>
          <div className="chipwrap" style={{ marginTop: 6 }}>
            {services.map((s) => (
              <Chip key={s.key} selected={draft.serviceTags.includes(s.key)} onClick={() => setDraft({ ...draft, serviceTags: toggle(draft.serviceTags, s.key) })}>{s.label}</Chip>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <Button variant="secondary" style={{ flex: 1 }} onClick={() => setDraft(EMPTY_FILTERS)}>Reset</Button>
        <Button style={{ flex: 2 }} onClick={() => { onApply(draft); onClose(); }}>Apply filters</Button>
      </div>
    </BottomSheet>
  );
}
