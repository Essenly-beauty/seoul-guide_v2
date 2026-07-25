"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(Boolean(host), onClose, closeRef);
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
      <div ref={dialogRef} className="sheet" role="dialog" aria-modal="true" aria-label="Detail filters" tabIndex={-1}>
        <div className="shead">
          <div>
            <div className="label">Filters</div>
            <b>{cat === "all" ? "All categories" : TYPE_LABEL[cat]}</b>
          </div>
          <button ref={closeRef} className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="x" size="sm" /></button>
        </div>
        <div className="sbody stack">
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
          {services && (
            <div>
              <div className="label">{TYPE_LABEL[cat as PlaceType]} services</div>
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
        </div>
      </div>
    </div>,
    host,
  );
}
