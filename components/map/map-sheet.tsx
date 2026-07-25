"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { formatDistance, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";

type Snap = "peek" | "half" | "full";
const ORDER: Snap[] = ["peek", "half", "full"];

export function MapSheet({ places, origin, selectedId, onSelect, onClearSelection }: {
  places: Place[];
  origin: LatLng;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
}) {
  const [snap, setSnap] = useState<Snap>("peek");
  // Free-form height: while dragging the sheet follows the pointer 1:1 and
  // stays wherever it is released (user request); `offset` is the committed
  // translateY in px, null = the snap class position.
  const [offset, setOffset] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const listId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const dragStart = useRef<{ y: number; startOffset: number; min: number; max: number; last: number } | null>(null);
  const dragMoved = useRef(false); // suppresses the native click that follows a drag release
  const handleRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnPlaceId = useRef<string | null>(null);
  const previousSelectedId = useRef<string | null>(selectedId);

  const ranked = useMemo(
    () =>
      places
        .map((p) => ({ p, km: haversineKm(origin, { lat: p.lat, lng: p.lng }) }))
        .sort((a, b) => a.km - b.km),
    [places, origin],
  );
  const snapLabel = snap === "peek"
    ? `Nearby places list, collapsed. ${ranked.length} places. Press to expand halfway.`
    : snap === "half"
      ? `Nearby places list, half expanded. ${ranked.length} places. Press to fully expand.`
      : `Nearby places list, fully expanded. ${ranked.length} places. Press to collapse.`;

  useEffect(() => {
    const previous = previousSelectedId.current;
    previousSelectedId.current = selectedId;

    if (selectedId) {
      if (previous && previous !== selectedId) returnPlaceId.current = null;
      return;
    }
    if (!previous) return;

    const placeId = returnPlaceId.current;
    returnPlaceId.current = null;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      const focusWasLost = !active || active === document.body || active === document.documentElement;
      if (!focusWasLost) return;
      const target = (placeId ? rowRefs.current.get(placeId) : null) ?? handleRef.current;
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  const snapOffsets = () => {
    const h = sheetRef.current?.offsetHeight ?? 0;
    return { full: 0, half: h * 0.42, peek: Math.max(0, h - 116) } as const;
  };
  const currentOffset = () => offset ?? snapOffsets()[snap];

  const cycle = () => {
    setOffset(null); // snap classes take over again
    setSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek");
  };

  // Committed position → element style (skipped mid-drag; the move handler
  // writes the transform directly so the sheet tracks the finger without renders).
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || dragging) return;
    el.style.transform = offset !== null ? `translateY(${offset}px)` : "";
  }, [offset, snap, dragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragMoved.current = false;
    const so = snapOffsets();
    dragStart.current = { y: e.clientY, startOffset: currentOffset(), min: so.full, max: so.peek, last: currentOffset() };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragStart.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const next = Math.min(d.max, Math.max(d.min, d.startOffset + (e.clientY - d.y)));
    d.last = next;
    el.style.transform = `translateY(${next}px)`;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 6) {
      dragMoved.current = true;
      setOffset(d.last); // stay exactly where the user let go
      // nearest snap keeps the aria description and padding fallbacks honest
      const so = snapOffsets();
      const nearest = (Object.keys(so) as Snap[]).reduce((a, b) =>
        Math.abs(so[a] - d.last) <= Math.abs(so[b] - d.last) ? a : b);
      setSnap(nearest);
    }
  };
  const onHandleClick = () => {
    if (dragMoved.current) { dragMoved.current = false; return; }
    cycle();
  };
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // don't hijack keys bubbling from the inner button
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    cycle();
  };

  // Selecting a place keeps the sheet exactly where the user left it — the
  // callout opens in the visible map strip above instead (user decision).
  return (
    <section ref={sheetRef} className={`mapsheet ${snap}${dragging ? " dragging" : ""}`} aria-label="Nearby places">
      <div
        ref={handleRef}
        className="mapsheet-handle"
        role="button"
        tabIndex={0}
        aria-label={snapLabel}
        aria-expanded={snap !== "peek"}
        aria-controls={listId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragStart.current = null; setDragging(false); }}
        onClick={onHandleClick}
        onKeyDown={onHandleKeyDown}
      >
        <span className="mapsheet-grip" aria-hidden="true" />
        <div className="small" style={{ fontWeight: 600 }}>{ranked.length} places near you</div>
      </div>

      <div
        id={listId}
        className="mapsheet-body"
        style={offset !== null ? { paddingBottom: `calc(${Math.round(offset)}px + 84px + env(safe-area-inset-bottom))` } : undefined}
      >
        {ranked.map(({ p, km }) => (
            <button
              key={p.id}
              ref={(node) => {
                if (node) rowRefs.current.set(p.id, node);
                else rowRefs.current.delete(p.id);
              }}
              type="button"
              className={"maprow" + (selectedId === p.id ? " on" : "")}
              aria-current={selectedId === p.id ? "true" : undefined}
              onClick={() => {
                returnPlaceId.current = p.id;
                onSelect(p.id);
              }}
            >
              <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
                <Icon name="pin" size="sm" style={{ color: "var(--accent)" }} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="caption muted">
                  <span className="mono">{formatDistance(km)}</span>
                  {km <= 3 && <> · ~{walkMinutes(km)} min walk</>}
                  {p.rating && <> · <span className="stars">★ {p.rating}</span></>}
                  {/* price folded into the meta line — the right-edge chip read too heavy */}
                  <> · <span className="mono">{p.priceRange}</span></>
                  {p.englishOk && <> · English OK</>}
                </div>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
}
