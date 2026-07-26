"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon } from "@/components/icon";
import { TYPE_COLOR, TYPE_ICON, TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { formatDistance, googleDirectionsUrl, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";
import { visibleMapAnchor } from "@/lib/map-camera";
import { routes } from "@/lib/routes";
import { LINE_META, STATIONS, stationExits } from "@/lib/subway";

export type MapViewProps = {
  center: LatLng;
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userLoc: LatLng | null;
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
  /** Large selected-place callout is reserved for the unconstrained map view. */
  showSelectedCallout?: boolean;
  /** Fires on user-initiated pan/zoom — parent shows "Search this area". */
  onUserMove: () => void;
  /** Parent receives a bounds getter for area re-search. */
  getBounds?: (fn: () => { south: number; west: number; north: number; east: number }) => void;
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
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
function pinIcon(place: Place, selected: boolean, mode: PinMode) {
  const key = `${place.id}:${mode}:${selected}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const icon =
    mode === "dot"
      ? L.divIcon({
          className: "map-anchor",
          html: `<div class="pin-hitarea"><div class="pin-dot" style="background:${TYPE_COLOR[place.type]}"></div></div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
      : selected
        ? L.divIcon({
            // Compact enlarged icon — rating/LIVE already live in the callout above;
            // the old wide dark badge duplicated them and covered neighboring pins.
            className: "map-anchor",
            html: `<div class="pin-hitarea badge-hit"><div class="pin-selected" style="background:${TYPE_COLOR[place.type]}"><svg class="icn" aria-hidden="true"><use href="#i-${TYPE_ICON[place.type]}"/></svg></div></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 44],
          })
        : L.divIcon({
            className: "map-anchor",
            html: `<div class="pin-hitarea badge-hit"><div class="pin-badge"><span class="catbadge" style="width:17px;height:17px;background:${TYPE_COLOR[place.type]}"><svg class="icn" style="width:11px;height:11px" aria-hidden="true"><use href="#i-${TYPE_ICON[place.type]}"/></svg></span>${place.rating ?? ""}</div></div>`,
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
  const badges = st.lines.slice(0, 2).map((line) =>
    `<span class="station-badge" style="background:${LINE_META[line].color}">${LINE_META[line].shortLabel}</span>`,
  ).join("");
  const icon = L.divIcon({
    className: "map-anchor",
    html: `<div class="station-marker">${badges}${labelled ? `<span class="station-marker-name">${st.name}</span>` : ""}</div>`,
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
const meIcon = L.divIcon({
  className: "map-anchor",
  html: '<div class="pin-me"></div>',
  iconSize: [14, 14],
});

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

function SelectedPlaceCallout({ place, userLoc, onDismiss }: {
  place: Place;
  userLoc: LatLng | null;
  onDismiss: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const distanceKm = userLoc ? haversineKm(userLoc, place) : null;
  const stationText = place.stationWalk
    ? `${place.stationWalk.minutes} min from ${place.stationWalk.station}${place.stationWalk.exit ? ` Exit ${place.stationWalk.exit}` : ""}`
    : place.address;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      closeRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [place.id]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      onDismiss();
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [onDismiss]);

  return (
    <Popup
      position={place}
      offset={L.point(0, -32)}
      className="map-place-popup"
      minWidth={286}
      maxWidth={340}
      closeButton={false}
      closeOnClick={false}
      closeOnEscapeKey={false}
      autoClose={false}
      autoPan={false}
    >
      <article className="map-place-callout" aria-labelledby={headingId}>
        <button
          ref={closeRef}
          className="map-place-callout-close"
          type="button"
          aria-label={`Close ${place.name} preview`}
          onClick={onDismiss}
        >
          <Icon name="x" size="xs" />
        </button>
        <div className="map-place-callout-main">
          <div className="map-place-callout-media">
            <CategoryBadge type={place.type} size={38} />
            <span>{TYPE_LABEL[place.type]}</span>
          </div>
          <div className="map-place-callout-copy">
            <span className="map-place-callout-kicker">{TYPE_LABEL[place.type]} · {zoneShort(place.zone)}</span>
            <h2 id={headingId}>{place.name}</h2>
            <p>{stationText}</p>
            <div className="map-place-callout-meta">
              {place.rating && <b aria-label={`${place.rating} out of 5 stars`}>★ {place.rating}</b>}
              {distanceKm !== null && (
                <span>{formatDistance(distanceKm)} · ~{walkMinutes(distanceKm)} min walk</span>
              )}
              {place.englishOk && <span>English OK</span>}
            </div>
          </div>
        </div>
        <div className="map-place-callout-actions">
          <a
            className="map-place-callout-action secondary"
            href={googleDirectionsUrl(place, userLoc, "walking")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size="xs" /> Directions
          </a>
          <Link className="map-place-callout-action primary" href={routes.place(place.id)}>
            View details <Icon name="chev" size="xs" />
          </Link>
        </div>
      </article>
    </Popup>
  );
}

export default function MapView({ center, places, selectedId, onSelect, userLoc, flyTarget, bottomInsetRatio, bottomInsetPx, focusZoom, focusYBias, showSelectedCallout = false, onUserMove, getBounds }: MapViewProps) {
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const mapRef = useRef<L.Map | null>(null);
  const selectedPlace = selectedId ? places.find((place) => place.id === selectedId) ?? null : null;

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
  const demoted = useMemo(() => {
    const map = mapRef.current;
    const out = new Set<string>();
    if (!map || zoom < BADGE_TOP_ZOOM || viewVersion < 0) return out;
    const candidates = singles
      .filter((p) => pinMode(p, p.id === selectedId, zoom) === "badge")
      .sort((a, b) =>
        a.id === selectedId ? -1 : b.id === selectedId ? 1 : (b.rating ?? 0) - (a.rating ?? 0),
      );
    const placed: { x: number; y: number }[] = [];
    for (const p of candidates) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      const overlaps = placed.some((q) => Math.abs(q.x - pt.x) < 76 && Math.abs(q.y - pt.y) < 34);
      if (overlaps && p.id !== selectedId) out.add(p.id);
      else placed.push({ x: pt.x, y: pt.y });
    }
    return out;
  }, [singles, selectedId, zoom, viewVersion]);

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
      singles.map((p) => {
        const selected = selectedId === p.id;
        const mode = demoted.has(p.id) ? "dot" : pinMode(p, selected, zoom);
        return (
          <Marker
            key={`${p.id}-${mode}-${selected}`}
            position={[p.lat, p.lng]}
            icon={pinIcon(p, selected, mode)}
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
    [singles, selectedId, onSelect, zoom, demoted],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={INITIAL_ZOOM}
      className="map-canvas"
      zoomControl={false}
      attributionControl={true}
    >
      <TileLayer url={TILE_URL} attribution={ATTRIB} />
      <MapWiring
        flyTarget={flyTarget}
        bottomInsetRatio={bottomInsetRatio}
        bottomInsetPx={bottomInsetPx}
        focusZoom={focusZoom}
        focusYBias={focusYBias}
        onUserMove={onUserMove}
        getBounds={getBounds}
        onZoom={setZoom}
        onMap={(m) => { mapRef.current = m; }}
        onView={() => setViewVersion((v) => v + 1)}
        onBlankTap={() => { if (selectedId) onSelect(null); }}
      />
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
      {/* Kakao-style transit layer — beneath place pins (negative z offsets) */}
      {transit.stations.map((id) => (
        <Marker
          key={`st-${id}-${zoom >= STATION_LABEL_ZOOM}`}
          position={[STATIONS[id].lat, STATIONS[id].lng]}
          icon={stationIcon(id, zoom >= STATION_LABEL_ZOOM)}
          interactive={false}
          keyboard={false}
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
      {showSelectedCallout && selectedPlace && (
        <SelectedPlaceCallout
          key={selectedPlace.id}
          place={selectedPlace}
          userLoc={userLoc}
          onDismiss={() => onSelect(null)}
        />
      )}
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
