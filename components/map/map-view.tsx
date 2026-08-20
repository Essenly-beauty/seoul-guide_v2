"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { Circle, MapContainer, Polyline, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@/components/icon";
import { TYPE_ICON, TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { haversineKm, type LatLng } from "@/lib/geo";
import { visibleMapAnchor } from "@/lib/map-camera";
import { useTheme } from "@/components/theme/theme-provider";
import { LINE_META, STATIONS, stationExits } from "@/lib/subway";

export type MapViewProps = {
  center: LatLng;
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userLoc: LatLng | null;
  /** Device heading in degrees clockwise from north, when available. */
  userHeading?: number | null;
  /** When set (e.g. locate FAB), the map animates to this point. */
  flyTarget: LatLng | null;
  /** Portion of the canvas covered by a bottom controller. */
  bottomInsetRatio?: number;
  /** Exact bottom overlay height. Takes precedence over bottomInsetRatio. */
  bottomInsetPx?: number;
  /** Zoom used for flyTarget changes. */
  focusZoom?: number;
  /** Vertical anchor bias within the visible band (0.5 center, >0.5 lower). */
  focusYBias?: number;
  /** Fires on user-initiated pan/zoom — parent shows "Search this area". */
  onUserMove: () => void;
  /** Parent receives a bounds getter for area re-search. */
  getBounds?: (fn: () => { south: number; west: number; north: number; east: number }) => void;
  /** Search-radius ring (subway station radius picker) — pale fill, translucent accent edge. */
  radiusCircle?: { center: LatLng; radiusKm: number } | null;
  /** Wayfinding path drawn in the brand orange (subway route stations). */
  routePath?: LatLng[] | null;
  /** Category filter active — pins switch from the muted to the vivid palette. */
  vividPins?: boolean;
  /** Station discs become tappable when set — opens the station's nearby browse. */
  onStationClick?: (id: string) => void;
};

const TILE_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
} as const;
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const INITIAL_ZOOM = 15; // neighborhood scale — dots/badges stay tappable on phones (was 13)
/** §4.2 zoom thresholds: dots/clusters ≤13, ★4.5+ badges 14–15, all badges ≥16. */
const BADGE_ALL_ZOOM = 16;
const BADGE_TOP_ZOOM = 14;
const CLUSTER_MAX_ZOOM = 13;
/** Kakao-style transit layer: station circles from z14, name labels from z16, exits from z17. */
const STATION_ZOOM = 14;
const STATION_LABEL_ZOOM = 16;
const EXIT_ZOOM = 17;
const CLUSTER_MIN = 5;
/** Grid cell edge in degrees — ~0.02° at z13, halving with each zoom-in step. */
const cellSize = (zoom: number) => 0.02 * Math.pow(2, CLUSTER_MAX_ZOOM - zoom);

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type PinMode = "dot" | "badge";

/** Map pins use a muted, desaturated take on the category palette — the dark
    basemap should read as one calm field, with category color as a hint, not
    a shout. Chips/callouts/search rows keep the vivid TYPE_COLOR: on UI
    surfaces saturation is information, on the map it was noise. The accent
    orange is reserved for exactly two things: the selected pin and the
    top-rated badge currently in view (see heroId). */
const MUTED_PIN_COLOR: Record<Place["type"], string> = {
  olive_young: "#75854a",
  skin_clinic: "#54687f",
  hair_salon: "#6d6390",
  nail_lash: "#8f6076",
  personal_color: "#8f7c4e",
  head_spa: "#4d7672",
  mall: "#7d505c",
  etc: "#565b64",
};
/** Vivid colors return when a category filter is active — browse mode stays
    calm, focus mode lights the chosen category up (user decision 2026-08-02). */
const VIVID_PIN_COLOR: Record<Place["type"], string> = {
  olive_young: "#9bce26",
  skin_clinic: "#4a7ddc",
  hair_salon: "#8e5bd8",
  nail_lash: "#e0559b",
  personal_color: "#dd9422",
  head_spa: "#2ba6a0",
  mall: "#a61e4d",
  etc: "#8b9098",
};
const pinColor = (type: Place["type"], vivid = false) =>
  vivid ? VIVID_PIN_COLOR[type] : MUTED_PIN_COLOR[type];

/** Olive Young dot markers use the olive motif (lime "O" + red drupe) on a
    map-toned disc, drawn a notch larger than ordinary dots (user request). */
const oyOliveHtml = (px: number) => `<svg viewBox="0 0 24 24" style="width:${px}px;height:${px}px" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="var(--pin-disc)" stroke="var(--pin-disc-ring)" stroke-width="1.2"/>
  <ellipse cx="12" cy="12.6" rx="5" ry="6.2" fill="none" stroke="#9bce26" stroke-width="2.6" transform="rotate(16 12 12.6)"/>
  <ellipse cx="14.1" cy="7.4" rx="1.7" ry="2.1" fill="#e0716e" transform="rotate(20 14.1 7.4)"/>
</svg>`;
/** OY discs run ~2x the ordinary 12px dots — the brand ask is "spot me first". */
const OY_DOT_PX = 26;
const pinGlyph = (type: Place["type"], px: number) =>
  `<svg class="icn" style="width:${px}px;height:${px}px" aria-hidden="true"><use href="#i-${TYPE_ICON[type]}"/></svg>`;
function pinMode(place: Place, selected: boolean, zoom: number): PinMode {
  if (selected) return "badge"; // selected pin is a badge at any zoom (§5.1)
  if (zoom >= BADGE_ALL_ZOOM) return "badge";
  if (zoom >= BADGE_TOP_ZOOM && (place.rating ?? 0) >= 4.5) return "badge";
  return "dot";
}

/** Cached per (place.id, selected, mode[, live]) — PLACES is static, so a handful of
 *  icons per place at most. Without this, every selection/zoom change hands
 *  react-leaflet a fresh icon object and it calls setIcon() on unaffected markers. */
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(place: Place, selected: boolean, mode: PinMode, hero = false, vivid = false) {
  const key = `${place.id}:${mode}:${selected}:${hero}:${vivid}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const icon =
    mode === "dot"
      ? L.divIcon({
          className: "map-anchor",
          html: place.type === "olive_young"
            ? `<div class="pin-hitarea"><div class="pin-oy">${oyOliveHtml(OY_DOT_PX)}</div></div>`
            : `<div class="pin-hitarea"><div class="pin-dot" style="background:${pinColor(place.type, vivid)}"></div></div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
      : selected
        ? L.divIcon({
            // Compact enlarged icon — rating/LIVE already live in the callout
            // above. Selection reads as a surface capsule with the category's
            // vivid glyph inside a thin accent ring — the solid orange capsule
            // shouted too loudly (user 2026-08-03).
            className: "map-anchor",
            html: `<div class="pin-hitarea badge-hit"><div class="pin-selected${place.type === "olive_young" ? " pin-selected-oy" : ""}" style="color:${VIVID_PIN_COLOR[place.type]}">${place.type === "olive_young" ? oyOliveHtml(24) : `<svg class="icn" aria-hidden="true"><use href="#i-${TYPE_ICON[place.type]}"/></svg>`}</div></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 44],
          })
        : L.divIcon({
            className: "map-anchor",
            // OY badges carry the olive logo disc instead of a lettered tile;
            // the hero accent tile never overrides the brand mark.
            html: `<div class="pin-hitarea badge-hit"><div class="pin-badge${hero ? " hero" : ""}">${place.type === "olive_young" ? oyOliveHtml(19) : `<span class="catbadge" style="width:17px;height:17px;background:${hero ? "var(--accent)" : pinColor(place.type, vivid)}">${pinGlyph(place.type, 11)}</span>`}${place.rating ?? ""}</div></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 44],
          });
  iconCache.set(key, icon);
  return icon;
}

const clusterIconCache = new Map<number, L.DivIcon>();
function clusterIcon(count: number) {
  const hit = clusterIconCache.get(count);
  if (hit) return hit;
  const icon = L.divIcon({
    className: "map-anchor",
    html: `<div class="pin-hitarea"><div class="pin-cluster">${count}</div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
  clusterIconCache.set(count, icon);
  return icon;
}

const stationIconCache = new Map<string, L.DivIcon>();
function stationIcon(id: string, labelled: boolean) {
  const key = `${id}:${labelled}`;
  const hit = stationIconCache.get(key);
  if (hit) return hit;
  const st = STATIONS[id];
  // Kakao-style: light disc ringed and numbered in the line color; the
  // station name hangs beneath in the (first) line's color.
  const discs = st.lines.slice(0, 3).map((line) =>
    `<span class="station-disc" style="border-color:${LINE_META[line].color};color:${LINE_META[line].color}">${LINE_META[line].shortLabel}</span>`,
  ).join("");
  const nameColor = LINE_META[st.lines[0]].color;
  const icon = L.divIcon({
    className: "map-anchor",
    html: `<div class="station-marker"><span class="station-disc-row">${discs}</span>${labelled ? `<span class="station-marker-name" style="color:${nameColor}">${st.name}</span>` : ""}</div>`,
    iconSize: [0, 0], // .station-marker centers itself on the anchor
  });
  stationIconCache.set(key, icon);
  return icon;
}

const exitIconCache = new Map<number, L.DivIcon>();
function exitIcon(no: number) {
  const hit = exitIconCache.get(no);
  if (hit) return hit;
  const icon = L.divIcon({
    className: "map-anchor",
    html: `<div class="exit-marker">${no}</div>`,
    iconSize: [16, 16],
  });
  exitIconCache.set(no, icon);
  return icon;
}

/** Red current-location marker (§3.2 — red is a confirmed decision). */
const meIconCache = new Map<string, L.DivIcon>();
function meIconForHeading(heading: number | null | undefined) {
  const normalized = typeof heading === "number" && Number.isFinite(heading)
    ? ((heading % 360) + 360) % 360
    : null;
  const key = normalized === null ? "unknown" : String(Math.round(normalized));
  const hit = meIconCache.get(key);
  if (hit) return hit;
  const arrow = normalized === null
    ? ""
    : `<span class="pin-me-arrow" style="transform:rotate(${normalized}deg)" aria-hidden="true"></span>`;
  const icon = L.divIcon({
    className: "map-anchor",
    html: `<div class="pin-me">${arrow}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  meIconCache.set(key, icon);
  return icon;
}

function mapTopInset(map: L.Map) {
  const container = map.getContainer();
  const mapRect = container.getBoundingClientRect();
  const topControls = container.closest(".map-screen")?.querySelector<HTMLElement>(".map-top");
  if (!topControls) return 0;
  const controlsRect = topControls.getBoundingClientRect();
  return Math.max(0, Math.min(mapRect.height, controlsRect.bottom - mapRect.top + 8));
}

function mapBottomInset(map: L.Map, fallback: number) {
  const container = map.getContainer();
  const mapRect = container.getBoundingClientRect();
  // Any bottom overlay counts: subway controller or the places sheet. The sheet
  // is transform-snapped, so measure its VISIBLE overlap via rects — focusing a
  // place must center within whatever map strip the user actually sees.
  const overlay = container.closest(".map-screen")?.querySelector<HTMLElement>(".subway-controller, .mapsheet");
  if (!overlay) return fallback;
  const overlayTop = overlay.getBoundingClientRect().top;
  return Math.max(0, Math.min(mapRect.height, mapRect.bottom - overlayTop));
}

function touchAngle(touches: TouchList) {
  const a = touches[0];
  const b = touches[1];
  return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);
}

function shortestAngleDelta(next: number, start: number) {
  return ((next - start + 540) % 360) - 180;
}

function MapRotationWiring({ bearing, onBearingChange }: { bearing: number; onBearingChange: (bearing: number) => void }) {
  const map = useMap();
  const bearingRef = useRef(bearing);
  useEffect(() => { bearingRef.current = bearing; }, [bearing]);

  useEffect(() => {
    const container = map.getContainer();
    const pane = map.getPane("mapPane");
    if (!pane) return;
    const gesture = { startAngle: 0, startBearing: 0, active: false };
    const apply = (next: number) => {
      const normalized = ((next % 360) + 360) % 360;
      bearingRef.current = normalized;
      pane.style.rotate = normalized === 0 ? "" : `${normalized}deg`;
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      gesture.startAngle = touchAngle(event.touches);
      gesture.startBearing = bearingRef.current;
      gesture.active = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!gesture.active || event.touches.length !== 2) return;
      event.preventDefault();
      apply(gesture.startBearing + shortestAngleDelta(touchAngle(event.touches), gesture.startAngle));
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!gesture.active || event.touches.length >= 2) return;
      gesture.active = false;
      onBearingChange(bearingRef.current);
    };
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      pane.style.rotate = "";
    };
  }, [map, onBearingChange]);

  useEffect(() => {
    const pane = map.getPane("mapPane");
    if (pane) pane.style.rotate = bearing === 0 ? "" : `${bearing}deg`;
  }, [bearing, map]);
  return null;
}

function MapRotationReset({ bearing, onReset }: { bearing: number; onReset: () => void }) {
  if (Math.abs(bearing) < 0.5) return null;
  return (
    <button
      type="button"
      className="map-rotation-reset"
      aria-label="Reset map rotation"
      title="Reset map rotation"
      style={{ transform: `rotate(${-bearing}deg)` }}
      onClick={(event) => {
        event.stopPropagation();
        onReset();
      }}
    >
      <span aria-hidden="true">N</span>
    </button>
  );
}

function MapWiring({ flyTarget, bottomInsetRatio = 0, bottomInsetPx, focusZoom, focusYBias = 0.5, onUserMove, getBounds, onZoom, onMap, onView, onBlankTap }: Pick<MapViewProps, "flyTarget" | "bottomInsetRatio" | "bottomInsetPx" | "focusZoom" | "focusYBias" | "onUserMove" | "getBounds"> & {
  onZoom: (z: number) => void;
  onMap: (m: L.Map) => void;
  /** Fires after any pan/zoom settles — collision pass re-projects pixel positions. */
  onView: () => void;
  /** Tap on empty map — parent dismisses the focused place (standard map UX). */
  onBlankTap: () => void;
}) {
  // zoomend/dragend fire for programmatic flyTo/setView too, not just user gestures.
  // Guard with this flag so "Search this area" doesn't appear after a GPS auto-fly.
  const flying = useRef(false);
  const map = useMapEvents({
    // Markers/popups stop propagation, so this only fires on empty map taps;
    // Leaflet also suppresses the click that follows a drag.
    click: () => onBlankTap(),
    dragend: () => { if (!flying.current) onUserMove(); },
    zoomend: () => { onZoom(map.getZoom()); if (!flying.current) onUserMove(); },
    moveend: () => { flying.current = false; onView(); },
  });
  useEffect(() => {
    onMap(map);
    onView(); // initial bounds are ready — let bounds-dependent layers compute
  }, [map, onMap, onView]);
  useEffect(() => {
    getBounds?.(() => {
      const b = map.getBounds();
      return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    });
  }, [map, getBounds]);
  const focusTarget = useCallback((animate: boolean) => {
    if (!flyTarget) return;
    map.invalidateSize({ animate: false, pan: false });
    const size = map.getSize();
    const coveredRatio = Math.max(0, Math.min(bottomInsetRatio, 0.85));
    const bottomInset = bottomInsetPx === undefined
      ? mapBottomInset(map, size.y * coveredRatio)
      : Math.max(0, Math.min(bottomInsetPx, size.y));
    const topInset = bottomInset > 0 ? mapTopInset(map) : 0;
    const anchor = visibleMapAnchor(
      { width: size.x, height: size.y },
      { top: topInset, bottom: bottomInset },
      focusYBias,
    );
    // A biased anchor means a callout opens above the pin — make sure the card
    // (~200px + 32px offset) clears the top chrome even in a short map strip,
    // while the pin itself stays above the sheet.
    if (focusYBias > 0.5) {
      const CALLOUT_HEADROOM = 252;
      const maxY = size.y - bottomInset - 28;
      anchor.y = Math.min(Math.max(anchor.y, topInset + CALLOUT_HEADROOM), maxY);
    }
    flying.current = true;

    // No explicit focusZoom → pan at the user's current zoom (selecting a pin
    // must never zoom the map out from under them).
    const targetZoom = focusZoom ?? map.getZoom();
    const projectedTarget = map.project([flyTarget.lat, flyTarget.lng], targetZoom);
    const center = map.unproject(
      projectedTarget.add(L.point(size.x / 2 - anchor.x, size.y / 2 - anchor.y)),
      targetZoom,
    );
    if (animate && !reducedMotion()) map.flyTo(center, targetZoom, { duration: 0.8 });
    else map.setView(center, targetZoom);
  }, [bottomInsetPx, bottomInsetRatio, flyTarget, focusYBias, focusZoom, map]);

  useEffect(() => focusTarget(true), [focusTarget]);
  useEffect(() => {
    if (!flyTarget || typeof ResizeObserver === "undefined") return;
    let firstResize = true;
    let timer: number | undefined;
    const refit = () => {
      if (firstResize) {
        firstResize = false;
        return;
      }
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => focusTarget(false), 140);
    };
    const observer = new ResizeObserver(refit);
    observer.observe(map.getContainer());
    const topControls = map.getContainer().closest(".map-screen")?.querySelector<HTMLElement>(".map-top");
    if (topControls) observer.observe(topControls);
    const bottomController = map.getContainer().closest(".map-screen")?.querySelector<HTMLElement>(".subway-controller");
    if (bottomController) {
      observer.observe(bottomController);
      bottomController.addEventListener("animationend", refit);
      bottomController.addEventListener("transitionend", refit);
    }
    window.visualViewport?.addEventListener("resize", refit);
    return () => {
      observer.disconnect();
      bottomController?.removeEventListener("animationend", refit);
      bottomController?.removeEventListener("transitionend", refit);
      window.visualViewport?.removeEventListener("resize", refit);
      if (timer) window.clearTimeout(timer);
    };
  }, [flyTarget, focusTarget, map]);
  return null;
}

function labelMarker(marker: L.Marker, label: string, selected?: boolean) {
  const element = marker.getElement();
  if (!element) return;
  element.setAttribute("aria-label", label);
  element.setAttribute("role", "button");
  if (selected === undefined) element.removeAttribute("aria-pressed");
  else element.setAttribute("aria-pressed", String(selected));
}

export default function MapView({ center, places, selectedId, onSelect, userLoc, userHeading, flyTarget, bottomInsetRatio, bottomInsetPx, focusZoom, focusYBias, onUserMove, getBounds, radiusCircle, routePath, vividPins = false, onStationClick }: MapViewProps) {
  // Warm the tile CDN's TLS handshake before Leaflet asks for the first
  // tile — the tiles are the page's LCP element (React 19 dedupes these).
  for (const s of ["a", "b", "c", "d"]) preconnect(`https://${s}.basemaps.cartocdn.com`);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [bearing, setBearing] = useState(0);
  // The current CSS proof-of-concept rotates Leaflet's rendered pane but not
  // Leaflet's interaction coordinate system. Keep it opt-in until a
  // rotation-aware map engine is wired and touch-regression tested.
  const rotationEnabled = process.env.NEXT_PUBLIC_ENABLE_EXPERIMENTAL_MAP_ROTATION === "1";
  const { theme } = useTheme();
  const mapRef = useRef<L.Map | null>(null);
  const meIcon = useMemo(() => meIconForHeading(userHeading), [userHeading]);

  // §4.2 Z ≤ 13: bucket into a lat/lng grid; cells with ≥5 places collapse into
  // one cluster pin. The selected place never clusters — it must stay a badge.
  const { singles, clusters } = useMemo(() => {
    if (zoom > CLUSTER_MAX_ZOOM) return { singles: places, clusters: [] as { lat: number; lng: number; count: number }[] };
    const size = cellSize(zoom);
    const cells = new Map<string, Place[]>();
    for (const p of places) {
      if (p.id === selectedId) continue;
      const key = `${Math.floor(p.lat / size)}:${Math.floor(p.lng / size)}`;
      const cell = cells.get(key);
      if (cell) cell.push(p);
      else cells.set(key, [p]);
    }
    const singles: Place[] = places.filter((p) => p.id === selectedId);
    const clusters: { lat: number; lng: number; count: number }[] = [];
    for (const members of cells.values()) {
      if (members.length >= CLUSTER_MIN) {
        clusters.push({
          lat: members.reduce((s, p) => s + p.lat, 0) / members.length,
          lng: members.reduce((s, p) => s + p.lng, 0) / members.length,
          count: members.length,
        });
      } else {
        singles.push(...members);
      }
    }
    return { singles, clusters };
  }, [places, selectedId, zoom]);

  // §4.2 badge collision pass: project badge candidates to container pixels and
  // greedily keep the highest-rated one per overlap region; losers demote to dots.
  // Re-runs whenever the view settles (viewVersion) so panning re-resolves overlaps.
  const [viewVersion, setViewVersion] = useState(0);
  // static snapshot overlay until the first tile batch paints (LCP bridge —
  // the same image the SSR fallback shows, so the hand-off is seamless)
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const handleTilesLoaded = useCallback(() => setTilesLoaded(true), []);
  // MapWiring re-runs its wiring effect whenever these identities change; inline
  // closures here re-render MapView every effect pass → maximum update depth loop.
  const handleMap = useCallback((m: L.Map) => { mapRef.current = m; }, []);
  const handleView = useCallback(() => setViewVersion((v) => v + 1), []);
  // Viewport cull (perf, 2026-08-15): only mount markers near the current
  // view — off-screen pins were never visible, but their ~600 divIcons
  // dominated hydration cost (Lighthouse TBT). 30% pad hides edge pop-in;
  // before the map instance exists, a distance guard around the initial
  // center keeps the first paint just as light.
  const inView = useMemo(() => {
    const map = mapRef.current;
    if (!map || viewVersion < 0) {
      return singles.filter((p) => haversineKm(center, p) < 4);
    }
    try {
      const b = map.getBounds().pad(0.3);
      return singles.filter((p) => b.contains([p.lat, p.lng]));
    } catch {
      return singles;
    }
  }, [singles, viewVersion, center]);

  // Also picks the accent "hero": the top-rated badge inside the current view.
  // Together with the selected pin that caps map orange at two elements.
  const { demoted, heroId } = useMemo(() => {
    const map = mapRef.current;
    const out = new Set<string>();
    let hero: string | null = null;
    if (!map || zoom < BADGE_TOP_ZOOM || viewVersion < 0) return { demoted: out, heroId: hero };
    const size = map.getSize();
    const candidates = inView
      .filter((p) => pinMode(p, p.id === selectedId, zoom) === "badge")
      .sort((a, b) =>
        a.id === selectedId ? -1 : b.id === selectedId ? 1 : (b.rating ?? 0) - (a.rating ?? 0),
      );
    const placed: { x: number; y: number }[] = [];
    for (const p of candidates) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      const overlaps = placed.some((q) => Math.abs(q.x - pt.x) < 76 && Math.abs(q.y - pt.y) < 34);
      if (overlaps && p.id !== selectedId) out.add(p.id);
      else {
        placed.push({ x: pt.x, y: pt.y });
        if (!hero && p.id !== selectedId && pt.x >= 0 && pt.x <= size.x && pt.y >= 0 && pt.y <= size.y) {
          hero = p.id;
        }
      }
    }
    return { demoted: out, heroId: hero };
  }, [inView, selectedId, zoom, viewVersion]);

  // Kakao-style transit layer: stations (line-colored circles + name) and
  // synthesized exit numbers, gated by zoom and limited to the viewport.
  const transit = useMemo(() => {
    const map = mapRef.current;
    if (!map || zoom < STATION_ZOOM || viewVersion < 0) {
      return { stations: [] as string[], exits: [] as { id: string; no: number; lat: number; lng: number }[] };
    }
    const bounds = map.getBounds().pad(0.15);
    const stations = Object.keys(STATIONS).filter((id) => {
      const st = STATIONS[id];
      return bounds.contains([st.lat, st.lng]);
    });
    const exits = zoom >= EXIT_ZOOM
      ? stations.flatMap((id) => stationExits(id).map((e) => ({ id, ...e })))
      : [];
    return { stations, exits };
  }, [zoom, viewVersion]);

  const markers = useMemo(
    () =>
      inView.map((p) => {
        const selected = selectedId === p.id;
        const mode = demoted.has(p.id) ? "dot" : pinMode(p, selected, zoom);
        const hero = p.id === heroId && mode === "badge" && !selected;
        return (
          <Marker
            key={`${p.id}-${mode}-${selected}-${hero}-${vividPins}`}
            position={[p.lat, p.lng]}
            icon={pinIcon(p, selected, mode, hero, vividPins)}
            title={`${p.name}, ${TYPE_LABEL[p.type]}`}
            alt={`${p.name}, ${TYPE_LABEL[p.type]}`}
            eventHandlers={{
              add: (event) => labelMarker(
                event.target as L.Marker,
                `${p.name}, ${TYPE_LABEL[p.type]}, ${zoneShort(p.zone)}, ${p.rating ? `${p.rating} out of 5 stars` : "unrated"}`,
                selected,
              ),
              click: () => onSelect(p.id),
            }}
            zIndexOffset={selected ? 1000 : 0}
          />
        );
      }),
    [inView, selectedId, onSelect, zoom, demoted, heroId, vividPins],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={INITIAL_ZOOM}
      className="map-canvas"
      zoomControl={false}
      attributionControl={true}
    >
      <TileLayer key={theme} url={TILE_URLS[theme]} attribution={ATTRIB} eventHandlers={{ load: handleTilesLoaded }} />
      {!tilesLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={`map-ph map-ph-${theme} map-ph-fade`} src={`/map-placeholder-${theme}.jpg`} alt="" />
      )}
      <MapWiring
        flyTarget={flyTarget}
        bottomInsetRatio={bottomInsetRatio}
        bottomInsetPx={bottomInsetPx}
        focusZoom={focusZoom}
        focusYBias={focusYBias}
        onUserMove={onUserMove}
        getBounds={getBounds}
        onZoom={setZoom}
        onMap={handleMap}
        onView={handleView}
        onBlankTap={() => { if (selectedId) onSelect(null); }}
      />
      {rotationEnabled && (
        <>
          <MapRotationWiring bearing={bearing} onBearingChange={setBearing} />
          <MapRotationReset bearing={bearing} onReset={() => setBearing(0)} />
        </>
      )}
      {/* Wayfinding path — the route's stations joined in the brand orange. */}
      {routePath && routePath.length >= 2 && (
        <Polyline
          positions={routePath.map((p) => [p.lat, p.lng] as [number, number])}
          interactive={false}
          pathOptions={{ color: "#f55800", weight: 4, opacity: 0.85, lineJoin: "round", lineCap: "round" }}
        />
      )}
      {/* Search-radius ring — pale wash inside, translucent accent edge; sits
          in the vector pane beneath markers and never intercepts taps. */}
      {radiusCircle && (
        <Circle
          center={[radiusCircle.center.lat, radiusCircle.center.lng]}
          radius={radiusCircle.radiusKm * 1000}
          interactive={false}
          pathOptions={{
            color: "#f55800",
            weight: 1.5,
            opacity: 0.45,
            fillColor: "#f55800",
            fillOpacity: 0.05,
          }}
        />
      )}
      {userLoc && (
        <Marker
          position={[userLoc.lat, userLoc.lng]}
          icon={meIcon}
          interactive={false}
          keyboard={false}
          alt="Your current location"
          title="Your current location"
        />
      )}
      {/* Kakao-style transit layer — beneath place pins (negative z offsets).
          Stations are tappable (opens nearby browse) when a handler is wired. */}
      {transit.stations.map((id) => (
        <Marker
          key={`st-${id}-${zoom >= STATION_LABEL_ZOOM}-${!!onStationClick}`}
          position={[STATIONS[id].lat, STATIONS[id].lng]}
          icon={stationIcon(id, zoom >= STATION_LABEL_ZOOM)}
          interactive={!!onStationClick}
          keyboard={false}
          title={`${STATIONS[id].name} Station`}
          alt={`${STATIONS[id].name} Station`}
          eventHandlers={onStationClick ? { click: () => onStationClick(id) } : undefined}
          zIndexOffset={-200}
        />
      ))}
      {transit.exits.map((e) => (
        <Marker
          key={`ex-${e.id}-${e.no}`}
          position={[e.lat, e.lng]}
          icon={exitIcon(e.no)}
          interactive={false}
          keyboard={false}
          zIndexOffset={-100}
        />
      ))}
      {markers}
      {clusters.map((c) => (
        <Marker
          key={`cluster-${c.lat.toFixed(4)}-${c.lng.toFixed(4)}-${c.count}`}
          position={[c.lat, c.lng]}
          icon={clusterIcon(c.count)}
          title={`${c.count} places`}
          alt={`${c.count} places`}
          eventHandlers={{
            add: (event) => labelMarker(event.target as L.Marker, `${c.count} nearby places`),
            click: () => mapRef.current?.setView([c.lat, c.lng], zoom + 2),
          }}
        />
      ))}
    </MapContainer>
  );
}
