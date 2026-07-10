"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TYPE_ICON, type Place } from "@/lib/data";
import type { LatLng } from "@/lib/geo";

export type MapViewProps = {
  center: LatLng;
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userLoc: LatLng | null;
  /** When set (e.g. locate FAB), the map animates to this point. */
  flyTarget: LatLng | null;
  /** Fires on user-initiated pan/zoom — parent shows "Search this area". */
  onUserMove: () => void;
  /** Parent receives a bounds getter for area re-search. */
  getBounds?: (fn: () => { south: number; west: number; north: number; east: number }) => void;
  /** Route-mode station markers (rendered in addition to place markers). */
  stationPins?: { id: string; name: string; lat: number; lng: number }[];
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cached per (place.id, selected) — PLACES is static, so at most 2 icons per place.
 *  Without this, every selection change hands react-leaflet a fresh icon object and
 *  it calls setIcon() on all unaffected markers. */
const iconCache = new Map<string, L.DivIcon>();
function bubbleIcon(place: Place, selected: boolean) {
  const key = `${place.id}:${selected}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const rating = place.rating ? `<span class="mono">${place.rating}</span>` : "";
  const name = selected ? `<b>${place.name}</b>` : "";
  const icon = L.divIcon({
    className: "map-anchor",
    html: `<div class="map-bubble${selected ? " selected" : ""}"><svg class="icn" aria-hidden="true"><use href="#i-${TYPE_ICON[place.type]}"/></svg>${rating}${name}</div>`,
    iconSize: [0, 0],
  });
  iconCache.set(key, icon);
  return icon;
}

function MapWiring({ flyTarget, onUserMove, getBounds }: Pick<MapViewProps, "flyTarget" | "onUserMove" | "getBounds">) {
  // zoomend/dragend fire for programmatic flyTo/setView too, not just user gestures.
  // Guard with this flag so "Search this area" doesn't appear after a GPS auto-fly.
  const flying = useRef(false);
  const map = useMapEvents({
    dragend: () => { if (!flying.current) onUserMove(); },
    zoomend: () => { if (!flying.current) onUserMove(); },
    moveend: () => { flying.current = false; },
  });
  useEffect(() => {
    getBounds?.(() => {
      const b = map.getBounds();
      return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    });
  }, [map, getBounds]);
  useEffect(() => {
    if (!flyTarget) return;
    flying.current = true;
    if (reducedMotion()) map.setView([flyTarget.lat, flyTarget.lng], 14);
    else map.flyTo([flyTarget.lat, flyTarget.lng], 14, { duration: 0.8 });
  }, [flyTarget, map]);
  return null;
}

export default function MapView({ center, places, selectedId, onSelect, userLoc, flyTarget, onUserMove, getBounds, stationPins }: MapViewProps) {
  const markers = useMemo(
    () =>
      places.map((p) => (
        <Marker
          key={`${p.id}-${selectedId === p.id}`}
          position={[p.lat, p.lng]}
          icon={bubbleIcon(p, selectedId === p.id)}
          eventHandlers={{ click: () => onSelect(p.id) }}
          zIndexOffset={selectedId === p.id ? 1000 : 0}
        />
      )),
    [places, selectedId, onSelect],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="map-canvas"
      zoomControl={false}
      attributionControl={true}
    >
      <TileLayer url={TILE_URL} attribution={ATTRIB} />
      <MapWiring flyTarget={flyTarget} onUserMove={onUserMove} getBounds={getBounds} />
      {userLoc && (
        <>
          <CircleMarker center={[userLoc.lat, userLoc.lng]} radius={26} pathOptions={{ color: "transparent", fillColor: "#3b82f6" /* = var(--info); Leaflet cannot read CSS vars */, fillOpacity: 0.12 }} />
          <CircleMarker center={[userLoc.lat, userLoc.lng]} radius={7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#3b82f6" /* = var(--info); Leaflet cannot read CSS vars */, fillOpacity: 1 }} />
        </>
      )}
      {markers}
      {stationPins?.map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={9}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#1f2937" /* station pin — Leaflet cannot read CSS vars */, fillOpacity: 1 }} />
      ))}
    </MapContainer>
  );
}
