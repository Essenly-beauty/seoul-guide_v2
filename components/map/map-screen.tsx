"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preload } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { SubwayPlaceCategory, SubwaySnap } from "@/components/subway/subway-route-controller";
import { findRoute, findRouteVia, nearestStation, placesNearStation, STATIONS } from "@/lib/subway";

// Perf (2026-08-15): the route controller (~900 lines) and the rail
// geometry (~30KB of line paths behind routeTrackPath) only matter once
// subway mode opens — split them out of the /map first load. STATIONS
// stays eager: the base map's station discs need it at first paint.
const SubwayRouteController = dynamic(
  () => import("@/components/subway/subway-route-controller").then((m) => m.SubwayRouteController),
  { ssr: false },
);
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { fetchSharedList, type SharedList } from "@/lib/shared-lists";
import { useSigninNudge } from "@/components/auth/signin-nudge";
import { useAuthUser } from "@/lib/auth/use-auth";
import { useTheme } from "@/components/theme/theme-provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-canvas hero-img" aria-label="Loading map" />,
});

// LCP: the first tiles are the largest paint, but Leaflet only requests them
// after the MapView chunk loads and initializes. The initial center is fixed
// (Gangnam until GPS resolves), so the first-view tiles are deterministic —
// preload them with the page JS and they download in parallel with the chunk.
// Matches Leaflet's URL scheme exactly (subdomain abs(x+y)%3 over a/b/c,
// {r}='@2x' on retina) so the requests are warm cache hits.
const TILE_STYLE = { dark: "dark_all", light: "voyager" } as const;
const INITIAL_TILE_ZOOM = 15; // keep in sync with map-view INITIAL_ZOOM
function preloadInitialTiles(theme: "dark" | "light", center: LatLng) {
  const z = INITIAL_TILE_ZOOM;
  const n = 2 ** z;
  const x = Math.floor(((center.lng + 180) / 360) * n);
  const latRad = (center.lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const r = typeof window !== "undefined" && window.devicePixelRatio > 1 ? "@2x" : "";
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      const tx = x + dx;
      const ty = y + dy;
      const s = "abc"[Math.abs(tx + ty) % 3];
      preload(`https://${s}.basemaps.cartocdn.com/rastertiles/${TILE_STYLE[theme]}/${z}/${tx}/${ty}${r}.png`, { as: "image" });
    }
  }
}

/** Map focus inset per route-controller snap, so the focused station clears the panel. */
const SUBWAY_SNAP_INSET: Record<SubwaySnap, number> = { compact: 0.22, half: 0.5, full: 0.8 };
/** The selected-place sheet intentionally leaves only its handle visible. */

export function MapScreen() {
  // Multi-select category chips (user decision 2026-08-02); empty = all.
  const [cats, setCats] = useState<PlaceType[]>([]);
  // Saved-only map layer (Kakao-style favorites view, 2026-08-09)
  const [favOnly, setFavOnly] = useState(false);
  const favs = useFavorites();
  const [mode, setMode] = useState<"map" | "subway">("map");
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { loc, status, heading, retry, requestHeading } = useLocation();
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  // Location-off banner is feedback for the locate FAB only — it must never
  // greet people on entry (user report 2026-08-16). Starts dismissed; the
  // FAB un-dismisses it when tapped without a fix.
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const centerRef = useRef(loc ?? GANGNAM_STATION); // 최초 마운트 center 고정용
  const [moved, setMoved] = useState(false);
  const [area, setArea] = useState<{ south: number; west: number; north: number; east: number } | null>(null);
  const boundsGetter = useRef<(() => { south: number; west: number; north: number; east: number }) | null>(null);
  const [departure, setDeparture] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [vias, setVias] = useState<string[]>([]);
  const [subwaySnap, setSubwaySnap] = useState<SubwaySnap>("half");
  const [activeStation, setActiveStation] = useState<string | null>(null);
  // owner decision 2026-08-22: 500 m is the browse default — a walkable
  // radius, not a "everything in the district" radius
  const [stationRadius, setStationRadius] = useState(0.5);
  const [stationCategory, setStationCategory] = useState<SubwayPlaceCategory>("all");
  const [subwayEditing, setSubwayEditing] = useState(false);
  const { user: authUser } = useAuthUser();
  const { nudge, sheet: nudgeSheet } = useSigninNudge();
  const { theme } = useTheme();
  preloadInitialTiles(theme, centerRef.current);
  // rail geometry loads on first subway use (see the dynamic import note above)
  const [trackPath, setTrackPath] = useState<typeof import("@/lib/subway-path").routeTrackPath | null>(null);
  useEffect(() => {
    if (mode !== "subway" || trackPath) return;
    let alive = true;
    void import("@/lib/subway-path").then((m) => {
      if (alive) setTrackPath(() => m.routeTrackPath);
    });
    return () => { alive = false; };
  }, [mode, trackPath]);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const subwayBtnRef = useRef<HTMLButtonElement>(null);
  const initialLocationHandledRef = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const deepLinkedPlace = searchParams.get("place");
  const listParam = searchParams.get("list");
  const savedParam = searchParams.get("saved");
  const savedOnly = favOnly || savedParam === "1";

  // Shared favorite list `/map?list={uuid}` (user request 2026-08-16):
  // narrow the map to the shared pins with a banner naming the list.
  const [sharedList, setSharedList] = useState<SharedList | null>(null);
  useEffect(() => {
    if (!listParam) {
      setSharedList(null);
      return;
    }
    let alive = true;
    void fetchSharedList(listParam).then((list) => {
      if (!alive) return;
      if (list) {
        setSharedList(list);
        return;
      }
      toast("That shared list link isn't available");
      router.replace(routes.map);
    });
    return () => { alive = false; };
  }, [listParam, router, toast]);

  // Camera: center on the shared pins, and don't let GPS auto-fly steal it.
  useEffect(() => {
    if (!sharedList) return;
    initialLocationHandledRef.current = true;
    const pts = sharedList.placeIds.map((id) => getPlace(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (pts.length === 0) return;
    setFlyTarget({
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    });
  }, [sharedList]);

  // `/map?saved=1` is the Saved tab's scoped "See all" destination. Center
  // the camera on those places and keep the URL as the source of truth so a
  // reload never flashes the full catalog.
  useEffect(() => {
    if (savedParam !== "1" || sharedList) return;
    initialLocationHandledRef.current = true;
    const pts = favs.place.map((id) => getPlace(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (pts.length === 0) return;
    setFlyTarget({
      lat: pts.reduce((sum, place) => sum + place.lat, 0) / pts.length,
      lng: pts.reduce((sum, place) => sum + place.lng, 0) / pts.length,
    });
  }, [favs.place, savedParam, sharedList]);

  const saveAllShared = useCallback(() => {
    if (!sharedList) return;
    const have = new Set(favs.place);
    let added = 0;
    for (const id of sharedList.placeIds) {
      if (!have.has(id)) {
        toggleFavorite("place", id);
        added += 1;
      }
    }
    toast(added > 0 ? `Saved ${added} place${added === 1 ? "" : "s"} to your list` : "Already in your list");
    // guests keep the local save (consistent with hearts) and meet the funnel
    if (!authUser && added > 0) nudge("favorite");
  }, [authUser, favs.place, nudge, sharedList, toast]);

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
  // Station-first search lands here: /map?mode=subway&station=<id> browses the
  // station without asking for a route (phase 1).
  const modeParam = searchParams.get("mode");
  const stationParam = searchParams.get("station");
  useEffect(() => {
    if (modeParam !== "subway" || !stationParam || !STATIONS[stationParam]) return;
    initialLocationHandledRef.current = true; // the deep link owns the camera
    setActiveStation(stationParam);
    setSubwayEditing(true);
    setSelectedId(null);
    setMode("subway");
    setFlyTarget({ lat: STATIONS[stationParam].lat, lng: STATIONS[stationParam].lng });
  }, [modeParam, stationParam]);

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

    let list = applyFilters(PLACES, cats, filters, loc ?? GANGNAM_STATION);
    // A shared list owns the layer (the recipient came to see it); otherwise
    // the Kakao-style heart FAB narrows the map to the viewer's favorites.
    if (sharedList) {
      const shared = new Set(sharedList.placeIds);
      list = list.filter((p) => shared.has(p.id));
    } else if (savedOnly) {
      const saved = new Set(favs.place);
      list = list.filter((p) => saved.has(p.id));
    }
    if (area) list = list.filter((p) => p.lat >= area.south && p.lat <= area.north && p.lng >= area.west && p.lng <= area.east);
    return list;
  }, [activeStation, area, cats, favs.place, filters, loc, mode, savedOnly, sharedList, stationCategory, stationRadius]);

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

  // A fix arriving (FAB retry granted) makes the banner stale — hide it.
  useEffect(() => {
    if (loc) setBannerDismissed(true);
  }, [loc]);

  useEffect(() => {
    // A ?place= deep link owns the camera — don't let the GPS auto-fly steal it.
    // Subway mode owns the camera too: resolving GPS must not pull it away
    // from the station selected in the bottom controller.
    if (status !== "granted" || !loc || initialLocationHandledRef.current) return;
    initialLocationHandledRef.current = true;
    if (mode === "map" && !deepLinkedPlace && !listParam && savedParam !== "1") setFlyTarget(loc);
  }, [status, loc, deepLinkedPlace, listParam, mode, savedParam]);

  return (
    <div className={`map-screen${mode === "subway" ? ` subway-mode${subwayRouteReady ? " subway-route-ready" : ""}${subwayEditing ? " subway-editing" : ""}` : ""}`}>
      <MapView
        center={centerRef.current}
        places={places}
        selectedId={selectedId}
        onSelect={handleMapSelect}
        userLoc={loc}
        userHeading={heading}
        flyTarget={flyTarget}
        bottomInsetRatio={mode === "subway" ? subwayRouteReady ? SUBWAY_SNAP_INSET[subwaySnap] : 0.6 : 0}
        focusYBias={mode === "map" && selectedId ? 0.62 : 0.5}
        focusZoom={focusZoom}
        onUserMove={() => { if (mode === "map") setMoved(true); }}
        getBounds={(fn) => { boundsGetter.current = fn; }}
        radiusCircle={mode === "subway" && activeStation
          ? { center: { lat: STATIONS[activeStation].lat, lng: STATIONS[activeStation].lng }, radiusKm: stationRadius }
          : null}
        routePath={mode === "subway" && subwayRouteReady && route && trackPath ? trackPath(route) : null}
        vividPins={mode === "map" ? cats.length > 0 || Boolean(sharedList) || savedOnly : true /* station browse is a focused task */}
        onStationClick={mode === "map" ? (id) => {
          // Browse what is around the station. Presetting it as a route
          // departure (the old behaviour) turned a map tap into a form the
          // visitor never asked for — station-first redesign, phase 1.
          setSelectedId(null);
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
            <Link
              // The pill showed the station but did nothing, so there was no
              // way to search again without leaving subway mode (owner report
              // 2026-08-22). It is now the way back to station search.
              className="map-searchpill subway-map-context"
              href={routes.search}
              aria-label={activeStation ? `${STATIONS[activeStation].name} Station — search for another station or place` : "Search for a station"}
            >
              <Icon name="train" size="sm" style={{ color: "var(--accent)" }} aria-hidden="true" />
              <span className="small">{activeStation ? `${STATIONS[activeStation].name} Station` : "Choose a station below"}</span>
              <Icon name="search" size="xs" style={{ color: "var(--muted)", marginLeft: "auto" }} aria-hidden="true" />
            </Link>
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

      {nudgeSheet}
      {mode === "map" && !sharedList && (
        <button
          className={"map-fab map-fab-fav" + (savedOnly ? " on" : "")}
          aria-label={savedOnly ? "Show all places" : "Show only my saved places"}
          aria-pressed={savedOnly}
          title="My saved places"
          onClick={() => {
            // guests with nothing saved would just see an empty map — show
            // the account nudge instead of a broken-looking layer
            if (!savedOnly && !authUser && favs.place.length === 0) {
              nudge("savedLayer");
              return;
            }
            if (savedParam === "1") {
              setFavOnly(false);
              router.replace(routes.map);
            } else {
              setFavOnly((v) => !v);
            }
            handleMapSelect(null);
          }}
        >
          <Icon name={savedOnly ? "heart" : "heart-o"} size="sm" />
        </button>
      )}
      {mode === "map" && (
        <button
          className="map-fab"
          aria-label="Center on my location"
          onClick={() => {
            handleMapSelect(null);
            if (loc) {
              requestHeading();
              setFlyTarget({ ...loc });
            }
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
          moved={moved}
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
          onPlace={(id) => {
            // A place tapped in the station list has to open the place card —
            // MapSheet only mounts in map mode, so staying in subway mode just
            // highlighted a pin and offered nothing (owner report 2026-08-22).
            handleMapSelect(id);
            setMode("map");
          }}
          onClearRoute={() => {
            setDeparture(null);
            setArrival(null);
            setVias([]);
            setActiveStation(null);
            setSelectedId(null);
            setStationRadius(0.5);
            setStationCategory("all");
          }}
          onEditingChange={setSubwayEditing}
          onSnapChange={setSubwaySnap}
          locationStatus={status}
          onRetryLocation={retry}
          onClose={closeSubway}
        />
      )}

      {mode === "map" && sharedList && (
        <div className="map-banner" role="status">
          <Icon name="heart" size="xs" style={{ color: "var(--accent)", flex: "none" }} aria-hidden="true" />
          <span className="small" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <b>{sharedList.title}</b> · {sharedList.placeIds.length} places
          </span>
          <Button size="sm" style={{ flex: "none" }} onClick={saveAllShared}>Save all</Button>
          <IconButton name="x" label="Close shared list" size={32} iconSize="xs" onClick={() => router.replace(routes.map)} />
        </div>
      )}

      {mode === "map" && !sharedList && savedParam === "1" && (
        <div className="map-banner" role="status">
          <Icon name="heart" size="xs" style={{ color: "var(--accent)", flex: "none" }} aria-hidden="true" />
          <span className="small" style={{ flex: 1, minWidth: 0 }}>
            <b>Your saved places</b> · {favs.place.length} {favs.place.length === 1 ? "place" : "places"}
          </span>
          <IconButton name="x" label="Show all places" size={32} iconSize="xs" onClick={() => router.replace(routes.map)} />
        </div>
      )}

      {mode === "map" && !sharedList && savedParam !== "1" && status === "fallback" && !bannerDismissed && (
        <div className="map-banner" role="status">
          <span className="small" style={{ flex: 1, minWidth: 0 }}>Location is off — showing <b>Gangnam Station</b> as your starting point.</span>
          <div className="map-banner-actions">
            <Button size="sm" variant="secondary" onClick={retry}>Enable location</Button>
            <Link className="small map-banner-link" href={`${routes.settingsApp}#location`}>Settings</Link>
          </div>
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
