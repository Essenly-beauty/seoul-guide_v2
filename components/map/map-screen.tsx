"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { routes } from "@/lib/routes";
import { MAP_CATEGORIES, PLACES, SERVICE_FILTERS, getPlace, type PlaceType } from "@/lib/data";
import { CategoryChips } from "@/components/category/category-chips";
import { GANGNAM_STATION, haversineKm, type LatLng } from "@/lib/geo";
import { applyFilters, countActiveFilters, EMPTY_FILTERS, type MapFilters } from "@/lib/places";
import { useLocation } from "./use-location";
import { MapSheet } from "./map-sheet";
import { FilterSheet } from "./filter-sheet";
import { SubwayRouteController, type SubwayPlaceCategory, type SubwaySnap } from "@/components/subway/subway-route-controller";
import { findRoute, findRouteVia, nearestStation, placesNearStation, STATIONS } from "@/lib/subway";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-canvas hero-img" aria-label="Loading map" />,
});

/** Map focus inset per route-controller snap, so the focused station clears the panel. */
const SUBWAY_SNAP_INSET: Record<SubwaySnap, number> = { compact: 0.22, half: 0.5, full: 0.8 };
/** The selected-place sheet intentionally leaves only its handle visible. */

export function MapScreen() {
  // Multi-select category chips (user decision 2026-08-02); empty = all.
  const [cats, setCats] = useState<PlaceType[]>([]);
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
  const [vias, setVias] = useState<string[]>([]);
  const [subwaySnap, setSubwaySnap] = useState<SubwaySnap>("half");
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [stationRadius, setStationRadius] = useState(1);
  const [stationCategory, setStationCategory] = useState<SubwayPlaceCategory>("all");
  const [subwayEditing, setSubwayEditing] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const subwayBtnRef = useRef<HTMLButtonElement>(null);
  const initialLocationHandledRef = useRef(false);
  const searchParams = useSearchParams();
  const deepLinkedPlace = searchParams.get("place");

  // Search flow entry `/map?place={id}` (spec §2, §4.4): select the place and
  // fly to its pin so the B-1 sheet opens over the right spot.
  useEffect(() => {
    if (!deepLinkedPlace) return;
    const p = getPlace(deepLinkedPlace);
    if (!p) return;
    setSelectedId(p.id);
    setFlyTarget({ lat: p.lat, lng: p.lng });
  }, [deepLinkedPlace]);

  // Search shortcuts (spec §4.3): `?cat=` applies a category filter,
  // `?zone=` flies to that zone's place centroid.
  const catParam = searchParams.get("cat");
  const zoneParam = searchParams.get("zone");
  useEffect(() => {
    if (catParam && catParam !== "all" && MAP_CATEGORIES.some((c) => c.key === catParam)) {
      setCats([catParam as PlaceType]);
    }
  }, [catParam]);
  useEffect(() => {
    if (!zoneParam) return;
    const inZone = PLACES.filter((p) => p.zone === zoneParam);
    if (inZone.length === 0) return;
    setFlyTarget({
      lat: inZone.reduce((s, p) => s + p.lat, 0) / inZone.length,
      lng: inZone.reduce((s, p) => s + p.lng, 0) / inZone.length,
    });
  }, [zoneParam]);

  // Multi-select rail — functional updates so rapid toggles never clobber
  // each other; narrowing categories prunes now-invalid service tag filters.
  const toggleCat = useCallback((key: PlaceType) => {
    setCats((cur) => (cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key]));
    setSelectedId(null);
    setFlyTarget(null);
  }, []);
  const clearCats = useCallback(() => {
    setCats([]);
    setSelectedId(null);
    setFlyTarget(null);
  }, []);
  useEffect(() => {
    if (cats.length === 0) return; // "All" keeps whatever tags were chosen
    const allowed = new Set(cats.flatMap((c) => SERVICE_FILTERS[c] ?? []).map((s) => s.key));
    setFilters((f) => ({ ...f, serviceTags: f.serviceTags.filter((t) => allowed.has(t)) }));
  }, [cats]);

  const route = useMemo(
    () => departure && arrival && departure !== arrival
      ? vias.length > 0 ? findRouteVia(departure, vias, arrival) : findRoute(departure, arrival)
      : null,
    [departure, arrival, vias],
  );
  const subwayRouteReady = Boolean(route && !subwayEditing);

  const closeSubway = useCallback(() => {
    if (route) {
      const restoreId = activeStation && route.stations.includes(activeStation)
        ? activeStation
        : departure ?? route.stations[0];
      setActiveStation(restoreId);
      setFlyTarget({ lat: STATIONS[restoreId].lat, lng: STATIONS[restoreId].lng });
    } else {
      setActiveStation(null);
      setFlyTarget(null);
    }
    setSelectedId(null);
    setSubwayEditing(false);
    setMode("map");
    window.requestAnimationFrame(() => subwayBtnRef.current?.focus());
  }, [activeStation, departure, route]);

  // Selecting both endpoints focuses the map on the departure station. Keyed
  // on the endpoints (not the route object) so via edits recompute the route
  // without yanking focus back to departure. The route itself stays in the
  // bottom controller and is never drawn on the map.
  const routeEndpointsKey = route ? `${route.stations[0]}>${route.stations[route.stations.length - 1]}` : null;
  useEffect(() => {
    if (!routeEndpointsKey || !departure) return;
    setActiveStation(departure);
    setFlyTarget({ lat: STATIONS[departure].lat, lng: STATIONS[departure].lng });
    setSelectedId(null);
    setArea(null);
  }, [departure, routeEndpointsKey]);

  // Via edits can reroute the path; keep the focused station on the new route.
  useEffect(() => {
    if (!route) return;
    setActiveStation((current) => current && route.stations.includes(current) ? current : route.stations[0]);
  }, [route]);

  const places = useMemo(() => {
    if (mode === "subway") {
      if (!activeStation) return [];
      const nearby = placesNearStation(PLACES, activeStation, stationRadius);
      if (stationCategory === "olive_young") return nearby.filter((place) => place.type === "olive_young");
      if (stationCategory === "personal_color") return nearby.filter((place) => place.type === "personal_color");
      if (stationCategory === "mall") return nearby.filter((place) => place.type === "mall");
      if (stationCategory === "daiso") return [];
      if (stationCategory === "beauty") {
        return nearby.filter((place) => place.type !== "olive_young" && place.type !== "etc" && place.type !== "mall");
      }
      return nearby;
    }

    let list = applyFilters(PLACES, cats, filters);
    if (area) list = list.filter((p) => p.lat >= area.south && p.lat <= area.north && p.lng >= area.west && p.lng <= area.east);
    return list;
  }, [activeStation, area, cats, filters, mode, stationCategory, stationRadius]);

  const nearbyStationId = useMemo(() => {
    if (!loc) return null;
    const nearest = nearestStation(loc);
    return nearest && haversineKm(loc, nearest) <= 2 ? nearest.id : null;
  }, [loc]);

  // Subway radius changes intentionally re-zoom; the normal map passes
  // undefined so pin selection pans at whatever zoom the user is holding.
  const focusZoom = mode === "subway"
    ? stationRadius <= 0.5
      ? 15
      : stationRadius >= 2
        ? 13
        : 14
    : undefined;
  const activeFilterCount = countActiveFilters(filters);
  const filterLabel = activeFilterCount === 0
    ? "Detail filters, none active"
    : `Detail filters, ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`;
  const handleMapSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setFlyTarget(null);
      return;
    }
    setMoved(false);
    const place = getPlace(id);
    if (place) {
      initialLocationHandledRef.current = true;
      setFlyTarget({ lat: place.lat, lng: place.lng });
    }
  }, []);

  useEffect(() => {
    if (mode !== "subway" || !activeStation) return;
    const station = STATIONS[activeStation];
    if (station) setFlyTarget({ lat: station.lat, lng: station.lng });
  }, [activeStation, mode]);

  useEffect(() => {
    // A ?place= deep link owns the camera — don't let the GPS auto-fly steal it.
    // Subway mode owns the camera too: resolving GPS must not pull it away
    // from the station selected in the bottom controller.
    if (status !== "granted" || !loc || initialLocationHandledRef.current) return;
    initialLocationHandledRef.current = true;
    if (mode === "map" && !deepLinkedPlace) setFlyTarget(loc);
  }, [status, loc, deepLinkedPlace, mode]);

  return (
    <div className={`map-screen${mode === "subway" ? ` subway-mode${subwayRouteReady ? " subway-route-ready" : ""}${subwayEditing ? " subway-editing" : ""}` : ""}`}>
      <MapView
        center={centerRef.current}
        places={places}
        selectedId={selectedId}
        onSelect={handleMapSelect}
        userLoc={loc}
        flyTarget={flyTarget}
        bottomInsetRatio={mode === "subway" ? subwayRouteReady ? SUBWAY_SNAP_INSET[subwaySnap] : 0.6 : 0}
        focusYBias={mode === "map" && selectedId ? 0.62 : 0.5}
        focusZoom={focusZoom}
        showSelectedCallout={mode === "map"}
        onUserMove={() => { if (mode === "map") setMoved(true); }}
        getBounds={(fn) => { boundsGetter.current = fn; }}
        radiusCircle={mode === "subway" && activeStation
          ? { center: { lat: STATIONS[activeStation].lat, lng: STATIONS[activeStation].lng }, radiusKm: stationRadius }
          : null}
        routePath={mode === "subway" && subwayRouteReady && route
          ? route.stations.map((id) => ({ lat: STATIONS[id].lat, lng: STATIONS[id].lng }))
          : null}
        vividPins={mode === "map" ? cats.length > 0 : stationCategory !== "all"}
        onStationClick={mode === "map" ? (id) => {
          // Tapping a station disc opens the subway browse with it preset as
          // departure — the editor's "Near {station}" list shows radius shops.
          setSelectedId(null);
          setDeparture(id);
          setActiveStation(id);
          setSubwayEditing(true);
          setMode("subway");
        } : undefined}
      />

      <div className="map-top">
        <div className="row" style={{ gap: 8 }}>
          <Link className="map-avatar" href={routes.mypage} aria-label="My page">
            <Icon name="user" size="sm" />
          </Link>
          {mode === "map" ? (
            <Link className="map-searchpill" href={`${routes.search}?cat=${cats[0] ?? "all"}`}>
              <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
              <span className="small muted">Search places, areas</span>
            </Link>
          ) : (
            <div className="map-searchpill subway-map-context" aria-live="polite">
              <Icon name="train" size="sm" style={{ color: "var(--accent)" }} aria-hidden="true" />
              <span className="small">{activeStation ? `${STATIONS[activeStation].name} Station` : "Choose a station below"}</span>
            </div>
          )}
          <button
            ref={subwayBtnRef}
            className={"map-modebtn with-label" + (mode === "subway" ? " on" : "")}
            aria-pressed={mode === "subway"}
            aria-label="Plan by subway stations"
            title="Plan by subway stations"
            onClick={() => {
              if (mode === "subway") closeSubway();
              else {
                setSubwayEditing(!route);
                setMode("subway");
              }
            }}
          >
            <Icon name="train" size="sm" />
            <span>Subway</span>
          </button>
        </div>
        {mode === "map" && (
          <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <CategoryChips selected={cats} onToggle={toggleCat} onClear={clearCats} style={{ flex: 1 }} />
            <Chip
              buttonRef={filterBtnRef}
              className="filterbtn"
              aria-label={filterLabel}
              aria-expanded={filterOpen}
              aria-haspopup="dialog"
              onClick={() => setFilterOpen(true)}
            >
              <Icon name="chev" size="xs" style={{ transform: "rotate(90deg)" }} />
              {activeFilterCount > 0 && <span className="filterbadge" aria-hidden="true">{activeFilterCount}</span>}
            </Chip>
          </div>
        )}
        {mode === "map" && moved && (
          // className="selected" (not the selected prop) — this is a one-shot
          // action pill, not a toggle, so it must not announce aria-pressed.
          <Chip
            className="selected"
            style={{ justifySelf: "center" }}
            onClick={() => {
              setArea(boundsGetter.current ? boundsGetter.current() : null);
              setMoved(false);
              handleMapSelect(null);
            }}
          >
            Search this area
          </Chip>
        )}
        {mode === "map" && area && !moved && (
          <Chip style={{ justifySelf: "center" }} onClick={() => setArea(null)}>
            Clear area · show all
          </Chip>
        )}
      </div>

      {mode === "map" && (
        <button
          className="map-fab"
          aria-label="Center on my location"
          onClick={() => {
            handleMapSelect(null);
            if (loc) setFlyTarget({ ...loc });
            else {
              setBannerDismissed(false);
              initialLocationHandledRef.current = false;
              retry();
            }
          }}
        >
          <Icon name="locate" size="sm" />
        </button>
      )}

      {mode === "map" && (
        <MapSheet
          places={places}
          origin={loc ?? GANGNAM_STATION}
          selectedId={selectedId}
          onSelect={handleMapSelect}
          onClearSelection={() => handleMapSelect(null)}
        />
      )}

      {mode === "subway" && (
        <SubwayRouteController
          departureId={departure}
          arrivalId={arrival}
          viaIds={vias}
          route={route}
          activeStationId={activeStation}
          nearbyStationId={nearbyStationId}
          radiusKm={stationRadius}
          category={stationCategory}
          places={places}
          selectedPlaceId={selectedId}
          onDeparture={(id) => {
            setDeparture(id);
            if (id) {
              setActiveStation(id);
              setSelectedId(null);
              setFlyTarget({ lat: STATIONS[id].lat, lng: STATIONS[id].lng });
            } else {
              setActiveStation(arrival);
              if (arrival) setFlyTarget({ lat: STATIONS[arrival].lat, lng: STATIONS[arrival].lng });
            }
          }}
          onArrival={(id) => {
            setArrival(id);
            if (id && !departure) {
              setActiveStation(id);
              setSelectedId(null);
              setFlyTarget({ lat: STATIONS[id].lat, lng: STATIONS[id].lng });
            } else if (!id) {
              setActiveStation(departure);
              if (departure) setFlyTarget({ lat: STATIONS[departure].lat, lng: STATIONS[departure].lng });
            }
          }}
          onVias={setVias}
          onStation={(id) => {
            setActiveStation(id);
            setSelectedId(null);
            setFlyTarget(id ? { lat: STATIONS[id].lat, lng: STATIONS[id].lng } : null);
          }}
          onRadius={(radius) => {
            setStationRadius(radius);
            setSelectedId(null);
            if (activeStation) setFlyTarget({ lat: STATIONS[activeStation].lat, lng: STATIONS[activeStation].lng });
          }}
          onCategory={(nextCategory) => {
            setStationCategory(nextCategory);
            setSelectedId(null);
            if (activeStation) setFlyTarget({ lat: STATIONS[activeStation].lat, lng: STATIONS[activeStation].lng });
          }}
          onPlace={handleMapSelect}
          onClearRoute={() => {
            setDeparture(null);
            setArrival(null);
            setVias([]);
            setActiveStation(null);
            setSelectedId(null);
            setStationRadius(1);
            setStationCategory("all");
          }}
          onEditingChange={setSubwayEditing}
          onSnapChange={setSubwaySnap}
          locationStatus={status}
          onRetryLocation={retry}
          onClose={closeSubway}
        />
      )}

      {mode === "map" && status === "fallback" && !bannerDismissed && (
        <div className="map-banner" role="status">
          <span className="small">Location is off — showing <b>Gangnam Station</b> as your starting point.</span>
          <IconButton name="x" label="Dismiss" size={32} iconSize="xs" onClick={() => setBannerDismissed(true)} />
        </div>
      )}

      {filterOpen && (
        <FilterSheet
          cats={cats}
          filters={filters}
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            handleMapSelect(null);
          }}
          onClose={() => { setFilterOpen(false); filterBtnRef.current?.focus(); }}
        />
      )}
    </div>
  );
}
