"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { SelectedPlaceSummary } from "@/components/map/selected-place-summary";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { PlaceCtaBar } from "@/components/place/place-cta-bar";
import { SelectedPlaceActionBar } from "./selected-place-action-bar";
import { LiveBadge } from "@/components/ui/live-badge";
import { BRAND_MARK_SRC, getPlace, TYPE_COLOR, TYPE_ICON, TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { formatCompactDistance, haversineKm, type LatLng } from "@/lib/geo";
import {
  getMapSheetHalfOffsetRatio,
  nextMapSheetSnap,
  resolveReleaseSnap,
  resolveSelectedPlaceView,
  rubberBand,
  springKeyframes,
  type MapSheetSnap,
  didDrag,
} from "@/lib/map-sheet-state";

type Snap = MapSheetSnap;

/** Vertical travel before a touch counts as a drag rather than a tap.
    8px matches Android's touch slop; Apple's WWDC18 "Designing Fluid
    Interfaces" puts the swipe hysteresis around 10pt. 4px was inside the
    shake of a hand walking down the street. */
const DRAG_SLOP = 8;
/** Only the last stretch of the gesture decides its release velocity. */
const VELOCITY_WINDOW_MS = 80;

export function MapSheet({ places, origin, selectedId, groupPlaceIds = [], onSelect, onClearSelection, moved = false }: {
  places: Place[];
  origin: LatLng;
  selectedId: string | null;
  groupPlaceIds?: string[];
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
  const dragMoved = useRef(false); // suppresses the native click that follows a drag release
  const handleRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnPlaceId = useRef<string | null>(null);
  const previousSelectedId = useRef<string | null>(selectedId);
  const previousGroupKey = useRef("");

  const ranked = useMemo(
    () =>
      places
        .map((p) => ({ p, km: haversineKm(origin, { lat: p.lat, lng: p.lng }) }))
        .sort((a, b) => a.km - b.km),
    [places, origin],
  );
  // Resolve from the catalog, not just the filtered list. A place the visitor
  // explicitly picked — from the station browse, a deep link, a shared list —
  // must render even when the active category filter excludes it, otherwise
  // the tap silently does nothing and the sheet falls back to the generic
  // nearby list (owner report 2026-08-23).
  const selectedPlace = selectedId
    ? ranked.find(({ p }) => p.id === selectedId)?.p ?? getPlace(selectedId) ?? null
    : null;
  const selectedKm = selectedId ? ranked.find(({ p }) => p.id === selectedId)?.km ?? 0 : 0;
  const groupPlaces = useMemo(
    () => groupPlaceIds.map((id) => getPlace(id)).filter((place): place is Place => Boolean(place)),
    [groupPlaceIds],
  );
  const groupKey = groupPlaces.map((place) => place.id).join(":");
  const groupTitle = `${groupPlaces.length} places at this pin`;
  // Snap is the single source of truth for the selected-place presentation.
  // Keeping a second "collapsed" flag allowed compact + detail views to render
  // together when the two states disagreed during a drag or Map-tab cycle.
  const selectedView = resolveSelectedPlaceView(snap);
  const snapLabel = selectedPlace && selectedView === "compact"
    ? `Selected place preview collapsed. ${selectedPlace?.name ?? "Place"}. Press to reopen.`
    : groupPlaces.length > 1
      ? `${groupTitle}. Press to fully expand.`
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

  useEffect(() => {
    const previous = previousGroupKey.current;
    previousGroupKey.current = groupKey;
    if (!groupKey || groupKey === previous) return;
    setOffset(null);
    setSnap("half");
  }, [groupKey]);

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

  /** Height the peek snap must reveal: the slim handle, the compact summary
      and the action bar pinned under it. The compact card is only in the DOM
      at peek, so the last measurement is remembered for the drag that heads
      there; before any measurement a typical card is assumed. */
  const lastPeekHeight = useRef<number | null>(null);
  const peekVisibleHeight = useCallback(() => {
    if (!selectedPlace) return 62;
    const sheet = sheetRef.current;
    const summary = sheet?.querySelector(".selected-place-summary.compact");
    if (summary instanceof HTMLElement) {
      const bar = sheet?.parentElement?.querySelector(".selected-place-actions");
      const barHeight = bar instanceof HTMLElement ? bar.offsetHeight : 0;
      // 20px = the peek handle (.mapsheet.peek.has-selection .mapsheet-handle).
      lastPeekHeight.current = 20 + summary.offsetHeight + barHeight;
    }
    return lastPeekHeight.current ?? 236;
  }, [selectedPlace]);

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
      // Measure the peek content instead of assuming 136px. A long name wraps
      // to two lines and the category line fell below the cut, half-clipped by
      // the action bar (owner report 2026-08-23). Measuring means any content
      // — longer names, a new metadata row — sizes itself instead of silently
      // losing its last line.
      peek: Math.max(0, h - peekVisibleHeight()),
    } as const;
  };

  // The resting peek position comes from a CSS class. Hand it the measured
  // height so a drag's settle target and the class position are the same
  // pixel — otherwise the sheet twitched once the class took over, and the
  // compact card's last line sat under the action bar.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el || snap !== "peek" || !selectedPlace) return;
    el.style.setProperty("--selected-sheet-peek-height", `${peekVisibleHeight()}px`);
  }, [snap, selectedPlace, peekVisibleHeight]);

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

  // Committed position → element style (skipped while a gesture or its settle
  // animation owns the transform; those write to the element directly so the
  // sheet tracks the finger without a render per move).
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || dragging) return;
    el.style.transform = offset !== null ? `translateY(${offset}px)` : "";
  }, [offset, snap, dragging]);

  // ── Drag from anywhere on the sheet ──────────────────────────────────
  // A touch becomes a sheet drag only after DRAG_SLOP px of vertical travel,
  // so taps on rows and buttons keep their click and pointer capture is
  // never taken from them. Inside the scrollable body the finger scrolls,
  // except when it pulls down from the very top or lifts a sheet whose
  // content has nothing to scroll — then the sheet follows the finger (the
  // rule Apple Maps and Kakao use). Release picks a snap from the finger's
  // velocity and settles there with a spring that inherits that velocity;
  // grabbing mid-flight freezes the sheet under the finger and carries on.
  type SheetGesture = {
    pointerId: number;
    downX: number;
    downY: number;
    /** clientY at the moment the drag was confirmed, not at pointerdown. */
    y0: number;
    startOffset: number;
    min: number;
    max: number;
    dimension: number;
    scroller: HTMLElement | null;
    active: boolean;
    position: number;
    travel: number;
    samples: { t: number; y: number }[];
  };
  const gesture = useRef<SheetGesture | null>(null);
  const settle = useRef<Animation | null>(null);
  const claimTouch = useRef(false); // while true the sheet owns the touch and native scroll is held off

  const readTranslateY = () => {
    const el = sheetRef.current;
    if (!el) return 0;
    const t = getComputedStyle(el).transform;
    return !t || t === "none" ? 0 : new DOMMatrixReadOnly(t).m42;
  };

  /** Hand the position back to the snap classes without a visible hop. */
  const commitSnap = (target: Snap, at: number) => {
    const el = sheetRef.current;
    settle.current?.cancel();
    settle.current = null;
    if (el) el.style.transform = `translateY(${at}px)`;
    setOffset(null);
    setSnap(target);
    setDragging(false);
  };

  const settleTo = (target: Snap, to: number, from: number, velocity: number) => {
    const el = sheetRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const negligible = Math.abs(to - from) < 0.5 && Math.abs(velocity) < 0.05;
    if (reduceMotion || negligible || typeof el.animate !== "function") {
      commitSnap(target, to);
      return;
    }
    const { frames, duration } = springKeyframes({ from, to, velocity });
    settle.current?.cancel();
    const animation = el.animate(
      frames.map((y) => ({ transform: `translateY(${y}px)` })),
      { duration, easing: "linear", fill: "forwards" },
    );
    settle.current = animation;
    animation.onfinish = () => {
      if (settle.current === animation) commitSnap(target, to);
    };
  };

  const onSheetPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragMoved.current = false;
    const body = detailBodyRef.current;
    const target = e.target as HTMLElement;
    gesture.current = {
      pointerId: e.pointerId,
      downX: e.clientX,
      downY: e.clientY,
      y0: e.clientY,
      startOffset: 0,
      min: 0,
      max: 0,
      dimension: 1,
      scroller: body && body.contains(target) ? body : null,
      active: false,
      position: 0,
      travel: 0,
      samples: [],
    };
  };

  const onSheetPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const el = sheetRef.current;
    if (!g || !el || g.pointerId !== e.pointerId) return;
    if (!g.active) {
      const dx = e.clientX - g.downX;
      const dy = e.clientY - g.downY;
      if (Math.abs(dy) < DRAG_SLOP) return;
      if (Math.abs(dx) > Math.abs(dy)) { gesture.current = null; return; } // a sideways swipe (photo rail) is not ours
      const { scroller } = g;
      const canScroll = scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1;
      const atTop = scroller === null || scroller.scrollTop <= 0;
      const sheetWantsIt =
        scroller === null
        || (dy > 0 && atTop)
        || (dy < 0 && snap !== "full" && (!canScroll || selectedPlace !== null));
      if (!sheetWantsIt) { gesture.current = null; return; }
      // Confirmed. Freeze whatever motion is in flight and continue from there.
      const so = snapOffsets();
      const from = readTranslateY();
      settle.current?.cancel();
      settle.current = null;
      el.classList.add("dragging"); // transition off before the first follow-frame; React re-applies it
      el.style.transform = `translateY(${from}px)`;
      g.active = true;
      g.y0 = e.clientY;
      g.startOffset = from;
      g.position = from;
      g.min = so.full;
      g.max = so.peek;
      g.dimension = Math.max(1, el.offsetHeight);
      claimTouch.current = true;
      // Whether this counts as a drag is decided at release (didDrag) — a
      // confirmed gesture that goes nowhere must not eat the row's tap.
      dragMoved.current = false;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      setDragging(true);
    }
    g.travel = Math.max(g.travel, Math.abs(e.clientY - g.downY));
    const position = rubberBand(g.startOffset + (e.clientY - g.y0), g.min, g.max, g.dimension);
    g.position = position;
    g.samples.push({ t: e.timeStamp, y: position });
    while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > VELOCITY_WINDOW_MS) g.samples.shift();
    el.style.transform = `translateY(${position}px)`;
  };

  const finishGesture = (e: React.PointerEvent, cancelled = false) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    claimTouch.current = false;
    if (!g.active) return; // a tap — its click goes through untouched
    const so = snapOffsets();
    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const stale = !first || !last || last.t - first.t < 1 || e.timeStamp - last.t > VELOCITY_WINDOW_MS;
    const velocity = cancelled || stale ? 0 : (last.y - first.y) / (last.t - first.t);
    const target = resolveReleaseSnap({ offsets: so, position: g.position, velocity });
    dragMoved.current = didDrag({ travel: g.travel, target, snap, slop: DRAG_SLOP });
    settleTo(target, so[target], g.position, velocity);
  };

  // Chrome and Safari start a native scroll (and cancel our pointer stream)
  // on the first touchmove unless it is prevented, so the body's touchmove
  // is claimed here while a sheet drag is in progress. `passive: false` is
  // what makes that preventDefault count.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (claimTouch.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      settle.current?.cancel();
    };
  }, []);

  const onSheetClickCapture = (e: React.MouseEvent) => {
    if (!dragMoved.current) return;
    dragMoved.current = false;
    e.preventDefault();
    e.stopPropagation();
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
    <>
    <section
      ref={sheetRef}
      className={`mapsheet ${snap}${dragging ? " dragging" : ""}${selectedPlace ? " has-selection" : ""}`}
      aria-label="Nearby places"
      onPointerDown={onSheetPointerDown}
      onPointerMove={onSheetPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={(e) => finishGesture(e, true)}
      onClickCapture={onSheetClickCapture}
    >
      <div
        ref={handleRef}
        className="mapsheet-handle"
        role="button"
        tabIndex={0}
        aria-label={snapLabel}
        aria-expanded={snap !== "peek"}
        aria-controls={listId}
        onClick={onHandleClick}
        onKeyDown={onHandleKeyDown}
      >
        <span className="mapsheet-grip" aria-hidden="true" />
        {!selectedPlace && (
          <div
            className="small"
            style={{ fontWeight: 600 }}
            role={groupPlaces.length > 1 ? "heading" : undefined}
            aria-level={groupPlaces.length > 1 ? 2 : undefined}
          >
            {groupPlaces.length > 1 ? groupTitle : `${ranked.length} places near you`}
          </div>
        )}
      </div>

      {selectedPlace && selectedView === "compact" && (
        <div key={`compact:${selectedPlace.id}`} className="mapsheet-view-enter">
          <SelectedPlaceSummary
            place={selectedPlace}
            km={selectedKm}
            variant="compact"
            onOpen={openSelectedSummary}
            onDismiss={dismissSelectedSummary}
          />
        </div>
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
          <div key={`summary:${selectedPlace.id}`} className="mapsheet-view-enter">
            <SelectedPlaceSummary
              place={selectedPlace}
              km={selectedKm}
              variant="half"
              onDismiss={dismissSelectedSummary}
            />
          </div>
        ) : selectedPlace && selectedView === "detail" ? (
          <div key={`detail:${selectedPlace.id}`} className="mapsheet-view-enter">
            <PlaceDetailBody
              place={selectedPlace}
              onCollapse={() => collapseFullDetail()}
            />
          </div>
        ) : !selectedPlace && groupPlaces.length > 1 ? groupPlaces.map((place) => {
          const km = haversineKm(origin, { lat: place.lat, lng: place.lng });
          return (
            <button
              key={place.id}
              ref={(node) => {
                if (node) rowRefs.current.set(place.id, node);
                else rowRefs.current.delete(place.id);
              }}
              type="button"
              className="maprow maprow-coordinate-choice"
              onClick={() => {
                returnPlaceId.current = place.id;
                onSelect(place.id);
              }}
            >
              <MapRowThumb place={place} />
              <div className="maprow-copy">
                <span className="label">{TYPE_LABEL[place.type]} · {zoneShort(place.zone)}</span>
                <div className="place-name-primary">{place.name}</div>
                {place.nameKr !== place.name && (
                  <div className="place-name-secondary" lang="ko">{place.nameKr}</div>
                )}
                <div className="caption muted maprow-meta">
                  <LiveBadge hours={place.hours} showUntil={false} />
                  <span className="map-meta-token mono">{formatCompactDistance(km)}</span>
                  <span>{place.address}</span>
                </div>
              </div>
            </button>
          );
        }) : !selectedPlace ? ranked.map(({ p, km }) => (
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
              <MapRowThumb place={p} />
              <div className="maprow-copy">
                <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                <div className="place-name-primary">{p.name}</div>
                {p.nameKr !== p.name && (
                  <div className="place-name-secondary" lang="ko">{p.nameKr}</div>
                )}
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
    {/* Kakao-style: while a pin is active the sheet owns the bottom of the
        screen — Save / Share / the three route hand-offs — instead of
        leaving the tab bar underneath to clip the card (owner request
        2026-08-22). It renders OUTSIDE the sheet: the sheet is positioned by
        a transform, which makes it the containing block for anything fixed
        inside it, so an in-sheet bar lands at the sheet's off-screen bottom
        rather than the visitor's. The detail view keeps its own CTA bar. */}
    {selectedPlace && selectedView !== "detail" && (
      <SelectedPlaceActionBar place={selectedPlace} />
    )}
    </>
  );
}

/** Square media slot at the head of every list row. A verified photo wins;
    otherwise the retailer's own mark (Daiso, Olive Young) or the category's
    map-pin glyph in its category colour — the same marker language the map
    uses, so the list never shows a generic pin for a known brand (owner
    request 2026-09-12). */
function MapRowThumb({ place }: { place: Place }) {
  const placePhoto = place.photoThumbnail ?? place.photos?.[0] ?? place.photoUrl;
  const brandMark = BRAND_MARK_SRC[place.type];
  return (
    <div className="thumb hero-img maprow-thumb">
      {placePhoto ? (
        // Storefront URLs come from verified place data and are not limited to
        // one image host, so keep this thumbnail browser-native.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="maprow-photo"
          src={placePhoto}
          alt=""
          width={84}
          height={84}
          loading="lazy"
          decoding="async"
        />
      ) : brandMark ? (
        <span className="maprow-photo-fallback maprow-brand-fallback">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="maprow-brand-mark" src={brandMark} alt="" />
        </span>
      ) : (
        <span className="maprow-photo-fallback" style={{ color: TYPE_COLOR[place.type] }}>
          <Icon name={TYPE_ICON[place.type]} className="maprow-fallback-glyph" />
        </span>
      )}
    </div>
  );
}
