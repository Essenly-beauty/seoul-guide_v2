"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { PRICE_OPTIONS, SERVICE_FILTERS, TYPE_LABEL, type PlaceType, type PriceRange } from "@/lib/data";
import { EMPTY_FILTERS, type MapFilters } from "@/lib/places";

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function FilterSheet({ cat, filters, onApply, onClose }: {
  cat: "all" | PlaceType;
  filters: MapFilters;
  onApply: (f: MapFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MapFilters>(filters);
  const [host, setHost] = useState<Element | null>(null);
  const services = cat !== "all" ? SERVICE_FILTERS[cat] : undefined;

  // Anchor to .app-shell like DirectionsLauncher — .map-screen traps z-index
  // (its internal sub-scale runs up to 950), so an inline sheet here would
  // render under the map header/controls instead of above them.
  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  if (!host) return null;

  return createPortal(
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Detail filters">
        <div className="shead">
          <div>
            <div className="label">Filters</div>
            <b>{cat === "all" ? "All categories" : TYPE_LABEL[cat]}</b>
          </div>
          <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="x" size="sm" /></button>
        </div>
        <div className="sbody stack">
          <div>
            <div className="label">Rating & options</div>
            <div className="chipwrap" style={{ marginTop: 6 }}>
              <button className={"chip" + (draft.minRating4 ? " selected" : "")} aria-pressed={draft.minRating4} onClick={() => setDraft({ ...draft, minRating4: !draft.minRating4 })}>★ 4.0+</button>
              <button className={"chip" + (draft.englishOnly ? " selected" : "")} aria-pressed={draft.englishOnly} onClick={() => setDraft({ ...draft, englishOnly: !draft.englishOnly })}>English OK</button>
              <button className={"chip" + (draft.bookableOnly ? " selected" : "")} aria-pressed={draft.bookableOnly} onClick={() => setDraft({ ...draft, bookableOnly: !draft.bookableOnly })}>Bookable</button>
            </div>
          </div>
          <div>
            <div className="label">Price</div>
            <div className="chipwrap" style={{ marginTop: 6 }}>
              {PRICE_OPTIONS.map((p: PriceRange) => (
                <button key={p} className={"chip mono" + (draft.prices.includes(p) ? " selected" : "")} aria-pressed={draft.prices.includes(p)} onClick={() => setDraft({ ...draft, prices: toggle(draft.prices, p) })}>{p}</button>
              ))}
            </div>
          </div>
          {services && (
            <div>
              <div className="label">{TYPE_LABEL[cat as PlaceType]} services</div>
              <div className="chipwrap" style={{ marginTop: 6 }}>
                {services.map((s) => (
                  <button key={s.key} className={"chip" + (draft.serviceTags.includes(s.key) ? " selected" : "")} aria-pressed={draft.serviceTags.includes(s.key)} onClick={() => setDraft({ ...draft, serviceTags: toggle(draft.serviceTags, s.key) })}>{s.label}</button>
                ))}
              </div>
            </div>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setDraft(EMPTY_FILTERS)}>Reset</button>
            <button className="btn" style={{ flex: 2 }} onClick={() => { onApply(draft); onClose(); }}>Apply filters</button>
          </div>
        </div>
      </div>
    </div>,
    host,
  );
}
