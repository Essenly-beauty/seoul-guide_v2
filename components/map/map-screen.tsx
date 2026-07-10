"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandMark, Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PLACES, MAP_CATEGORIES, SERVICE_FILTERS, type PlaceType } from "@/lib/data";
import { GANGNAM_STATION, type LatLng } from "@/lib/geo";
import { applyFilters, countActiveFilters, EMPTY_FILTERS, type MapFilters } from "@/lib/places";
import { useLocation } from "./use-location";
import { MapSheet } from "./map-sheet";
import { FilterSheet } from "./filter-sheet";
import { SubwayMap } from "@/components/subway/subway-map";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-canvas hero-img" aria-label="Loading map" />,
});

export function MapScreen() {
  const [cat, setCat] = useState<"all" | PlaceType>("all");
  const [mode, setMode] = useState<"map" | "subway">("map");
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { loc, status, retry } = useLocation();
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const centerRef = useRef(loc ?? GANGNAM_STATION); // 최초 마운트 center 고정용
  const [moved, setMoved] = useState(false);
  const [area, setArea] = useState<{ south: number; west: number; north: number; east: number } | null>(null);
  const boundsGetter = useRef<(() => { south: number; west: number; north: number; east: number }) | null>(null);
  const [departure, setDeparture] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);

  const places = useMemo(() => {
    let list = applyFilters(PLACES, cat, filters);
    if (area) list = list.filter((p) => p.lat >= area.south && p.lat <= area.north && p.lng >= area.west && p.lng <= area.east);
    return list;
  }, [cat, filters, area]);

  useEffect(() => {
    if (status === "granted" && loc) setFlyTarget(loc);
  }, [status, loc]);

  return (
    <div className="map-screen">
      <MapView
        center={centerRef.current}
        places={places}
        selectedId={selectedId}
        onSelect={setSelectedId}
        userLoc={loc}
        flyTarget={flyTarget}
        onUserMove={() => setMoved(true)}
        getBounds={(fn) => { boundsGetter.current = fn; }}
      />

      {mode === "subway" && (
        <SubwayMap
          places={applyFilters(PLACES, cat, filters)}
          departure={departure}
          arrival={arrival}
          onSetDeparture={setDeparture}
          onSetArrival={setArrival}
        />
      )}

      <div className="map-top">
        <div className="row" style={{ gap: 8 }}>
          <BrandMark size={30} style={{ flex: "none" }} />
          <Link className="map-searchpill" href={`${routes.search}?cat=${cat}`}>
            <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
            <span className="small muted">Clinics, salons, nail studios…</span>
          </Link>
          <div className="segtoggle" role="tablist" aria-label="Map or subway view">
            <button role="tab" aria-selected={mode === "map"} className={mode === "map" ? "on" : ""} onClick={() => setMode("map")}>Map</button>
            <button role="tab" aria-selected={mode === "subway"} className={mode === "subway" ? "on" : ""} onClick={() => setMode("subway")}>Subway</button>
          </div>
        </div>
        {mode === "map" && (
          <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <div className="chiprow" role="group" aria-label="Filter by category" style={{ flex: 1 }}>
              {MAP_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className={"chip" + (cat === c.key ? " selected" : "")}
                  aria-pressed={cat === c.key}
                  onClick={() => {
                    setCat(c.key);
                    setSelectedId(null);
                    const allowed = new Set((c.key === "all" ? [] : SERVICE_FILTERS[c.key as PlaceType] ?? []).map((s) => s.key));
                    setFilters((f) => ({ ...f, serviceTags: f.serviceTags.filter((t) => allowed.has(t)) }));
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button className="chip filterbtn" aria-label="Detail filters" onClick={() => setFilterOpen(true)}>
              <Icon name="chev" size="xs" style={{ transform: "rotate(90deg)" }} />
              {countActiveFilters(filters) > 0 && <span className="filterbadge">{countActiveFilters(filters)}</span>}
            </button>
          </div>
        )}
        {moved && (
          <button
            className="chip selected"
            style={{ justifySelf: "center" }}
            onClick={() => { setArea(boundsGetter.current ? boundsGetter.current() : null); setMoved(false); setSelectedId(null); }}
          >
            Search this area
          </button>
        )}
        {area && !moved && (
          <button className="chip" style={{ justifySelf: "center" }} onClick={() => setArea(null)}>
            Clear area · show all
          </button>
        )}
      </div>

      <button
        className="map-fab"
        aria-label="Center on my location"
        onClick={() => (loc ? setFlyTarget({ ...loc }) : (setBannerDismissed(false), retry()))}
      >
        <Icon name="locate" size="sm" />
      </button>

      {mode === "map" && (
        <MapSheet
          places={places}
          origin={loc ?? GANGNAM_STATION}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClearSelection={() => setSelectedId(null)}
        />
      )}

      {status === "fallback" && !bannerDismissed && (
        <div className="map-banner" role="status">
          <span className="small">Location is off — showing <b>Gangnam Station</b> as your starting point.</span>
          <button className="iconbtn" style={{ width: 32, height: 32 }} aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>
            <Icon name="x" size="xs" />
          </button>
        </div>
      )}

      {filterOpen && (
        <FilterSheet
          cat={cat}
          filters={filters}
          onApply={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
