"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { SelectedPlaceSummary } from "@/components/map/selected-place-summary";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { PlaceCtaBar } from "@/components/place/place-cta-bar";
import { LiveBadge } from "@/components/ui/live-badge";
import { TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { formatCompactDistance, haversineKm, type LatLng } from "@/lib/geo";
import {
  getMapSheetHalfOffsetRatio,
  nextMapSheetSnap,
  resolveSelectedPlaceView,
  type MapSheetSnap,
} from "@/lib/map-sheet-state";

type Snap = MapSheetSnap;

export function MapSheet({ places, origin, selectedId, onSelect, onClearSelection, moved = false }: {
  places: Place[];
  origin: LatLng;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  /** True after the map camera has moved away from the selected pin. */
  moved?: boolean;
}) {
  // The first view keeps enough of the list visible to establish context;
  // the Map tab cycles half → full → peek → half from here.
  const [snap, setSnap] = useState<Snap>("half");
  // While dragging the sheet follows the pointer 1:1. Releasing resolves to
  // the closest of the three stable heights; `offset` is only a transient
  // translateY override, null = the snap class position.
  const [offset, setOffset] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const listId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const dragStart = useRef<{ y: number; startOffset: number; min: number; max: number; last: number } | null>(null);
  const dragMoved = useRef(false); // suppresses the native click that follows a drag release
  const handleRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
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
  const selectedPlace = selectedId ? ranked.find(({ p }) => p.id === selectedId)?.p ?? null : null;
  const selectedKm = selectedId ? ranked.find(({ p }) => p.id === selectedId)?.km ?? 0 : 0;
  // Snap is the single source of truth for the selected-place presentation.
  // Keeping a second "collapsed" flag allowed compact + detail views to render
  // together when the two states disagreed during a drag or Map-tab cycle.
  const selectedView = resolveSelectedPlaceView(snap);
  const snapLabel = selectedPlace && selectedView === "compact"
    ? `Selected place preview collapsed. ${selectedPlace?.name ?? "Place"}. Press to reopen.`
    : snap === "peek"
    ? `Nearby places list, collapsed. ${ranked.length} places. Press to expand halfway.`
    : snap === "half"
      ? `Nearby places list, half expanded. ${ranked.length} places. Press to fully expand.`
      : `Nearby places list, fully expanded. ${ranked.length} places. Press to collapse.`;

  useEffect(() => {
    const previous = previousSelectedId.current;
    previousSelectedId.current = selectedId;

    if (selectedId) {
      if (previous !== selectedId) {
        setOffset(null);
        setSnap("half");
      }
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

  // A newly selected place starts at the top of its detail preview. This also
  // prevents the previous place's scroll position from carrying over when a
  // visitor taps another row on the map.
  useEffect(() => {
    if (!selectedId) return;
    detailBodyRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  // Kakao-style progressive disclosure: once the visitor pans away from an
  // active pin, keep only the compact place summary above the bottom nav and
  // collapse the detail sheet around it without losing the selection.
  useEffect(() => {
    if (!selectedId) return;
    if (moved) {
      setOffset(null);
      setSnap("peek");
    }
  }, [moved, selectedId]);

  const snapOffsets = () => {
    // Every snap keeps the same outer sheet height; only translateY changes.
    // This avoids a layout jump when half/full settles into the compact peek.
    const currentHeight = sheetRef.current?.offsetHeight ?? 0;
    const parentHeight = sheetRef.current?.parentElement?.clientHeight ?? (typeof window !== "undefined" ? window.innerHeight : 0);
    const h = selectedPlace
      ? Math.max(currentHeight, parentHeight)
      : Math.max(currentHeight, parentHeight * 0.82);
    return {
      full: 0,
      half: h * getMapSheetHalfOffsetRatio(Boolean(selectedPlace)),
      peek: Math.max(0, h - (selectedPlace ? 136 : 62)),
    } as const;
  };
  const currentOffset = () => offset ?? snapOffsets()[snap];

  const cycle = useCallback(() => {
    setOffset(null); // snap classes take over again
    setSnap(nextMapSheetSnap);
  }, []);

  const promoteDetailToFull = () => {
    if (!selectedPlace || snap === "full") return;
    setOffset(null);
    setSnap("full");
  };
  const handleDetailScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 4) promoteDetailToFull();
  };

  // Bottom navigation remains a normal link (so it works from every page),
  // while an already-mounted map also gets the requested sheet-cycle action.
  useEffect(() => {
    const onMapCycle = () => cycle();
    window.addEventListener("myseouldrop:map-cycle", onMapCycle);
    return () => window.removeEventListener("myseouldrop:map-cycle", onMapCycle);
  }, [cycle]);

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
      const so = snapOffsets();
      const nearest = (Object.keys(so) as Snap[]).reduce((a, b) =>
        Math.abs(so[a] - d.last) <= Math.abs(so[b] - d.last) ? a : b);
      setOffset(null);
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

  const openSelectedSummary = () => {
    if (!selectedPlace) return;
    setOffset(null);
    setSnap("half");
    onSelect(selectedPlace.id);
  };
  const dismissSelectedSummary = () => {
    setOffset(null);
    setSnap("half");
    onClearSelection();
  };
  const collapseFullDetail = () => {
    setOffset(null);
    setSnap("half");
    detailBodyRef.current?.scrollTo({ top: 0 });
  };

  // Selecting a place changes the lower sheet into a Kakao-style detail
  // preview. The map callout remains available above it, while scrolling the
  // preview promotes the sheet to its full-height snap.
  return (
    <section ref={sheetRef} className={`mapsheet ${snap}${dragging ? " dragging" : ""}${selectedPlace ? " has-selection" : ""}`} aria-label="Nearby places">
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
        {!selectedPlace && (
          <div className="small" style={{ fontWeight: 600 }}>
            {`${ranked.length} places near you`}
          </div>
        )}
      </div>

      {selectedPlace && selectedView === "compact" && (
        <SelectedPlaceSummary
          place={selectedPlace}
          km={selectedKm}
          variant="compact"
          onOpen={openSelectedSummary}
          onDismiss={dismissSelectedSummary}
        />
      )}

      <div
        id={listId}
        ref={detailBodyRef}
        className={`mapsheet-body${selectedPlace ? " mapsheet-detail-body" : ""}`}
        style={offset !== null ? { paddingBottom: `calc(${Math.round(offset)}px + 84px + env(safe-area-inset-bottom))` } : undefined}
        onScroll={selectedPlace ? handleDetailScroll : undefined}
        onWheel={selectedPlace ? (e) => { if (Math.abs(e.deltaY) > 4) promoteDetailToFull(); } : undefined}
      >
        {selectedPlace && selectedView === "summary" ? (
          <SelectedPlaceSummary
            place={selectedPlace}
            km={selectedKm}
            variant="half"
            onDismiss={dismissSelectedSummary}
          />
        ) : selectedPlace && selectedView === "detail" ? (
          <PlaceDetailBody
            place={selectedPlace}
            onCollapse={() => collapseFullDetail()}
          />
        ) : !selectedPlace ? ranked.map(({ p, km }) => (
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
              <div className="thumb hero-img maprow-thumb">
                {p.photoUrl ? (
                  // Storefront URLs come from verified place data and are not limited to
                  // one image host, so keep this thumbnail browser-native.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="maprow-photo" src={p.photoUrl} alt="" />
                ) : (
                  <span className="maprow-photo-fallback">
                    <Icon name="pin" size="sm" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="caption muted maprow-meta">
                  <LiveBadge hours={p.hours} showUntil={false} />
                  <span className="map-meta-token mono">{formatCompactDistance(km)}</span>
                  {p.rating && <span className="map-meta-token stars">★{p.rating}</span>}
                  {/* price folded into the meta line — the right-edge chip read too heavy */}
                  <span className="map-meta-token mono">{p.priceRange}</span>
                  {p.englishOk && <span>English OK</span>}
                </div>
              </div>
            </button>
          )) : null}
      </div>
      {selectedPlace && selectedView === "detail" && <PlaceCtaBar place={selectedPlace} />}
    </section>
  );
}
