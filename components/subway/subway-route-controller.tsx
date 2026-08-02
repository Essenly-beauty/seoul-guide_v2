"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { RatingLine } from "@/components/ui/rating-line";
import { PRODUCTS, TYPE_LABEL, type Place } from "@/lib/data";
import { formatDistance, googleDirectionsUrl, haversineKm, naverMapUrl } from "@/lib/geo";
import { routes } from "@/lib/routes";
import {
  LINE_META,
  STATIONS,
  exactStationMatch,
  findRoute,
  findRouteVia,
  lineTextColor,
  moveRouteWaypoint,
  routeSegmentStartIndices,
  searchStations,
  stationDisplayName,
  travelMinutes,
  type SubwayRoute,
  type SubwayStation,
} from "@/lib/subway";
import { RouteStrip } from "./route-strip";

export type SubwayPlaceCategory = "all" | "beauty" | "olive_young" | "personal_color" | "mall" | "daiso";
/** Route-panel snap tiers — content is curated per tier, not just clipped. */
export type SubwaySnap = "compact" | "half" | "full";

const SNAP_ORDER: SubwaySnap[] = ["compact", "half", "full"];
const MAX_VIAS = 2;

const POPULAR_STATIONS = [
  "gangnam",
  "myeongdong",
  "hongik_univ",
  "seoul",
  "seongsu",
  "apgujeong_rodeo",
];
const RECENT_KEY = "essenly.recentSubwayStations";
const scrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

function readRecentStations(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && Boolean(STATIONS[id])).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

/** Rail stop marker: generic dot until a station is chosen, then the
    station's primary line as a colored numbered circle (user request). */
function RailStop({ stationId, kind }: { stationId: string | null; kind: "departure" | "via" | "arrival" }) {
  const station = stationId ? STATIONS[stationId] : undefined;
  if (!station) return <span className={`subway-route-dot ${kind}`} />;
  const meta = LINE_META[station.lines[0]];
  return (
    <span
      className="subway-route-dot line"
      style={{ background: meta.color, color: "#fff" }}
      aria-hidden="true"
    >
      {meta.shortLabel}
    </span>
  );
}

function StationLineBadges({ station }: { station: SubwayStation }) {
  return (
    <span className="station-linebadges" aria-label={station.lines.map((line) => LINE_META[line].label).join(", ")}>
      {station.lines.map((line) => (
        <span
          key={line}
          className="station-linebadge"
          style={{ background: LINE_META[line].color, color: lineTextColor(LINE_META[line].color) }}
          aria-hidden="true"
        >
          {LINE_META[line].shortLabel}
        </span>
      ))}
    </span>
  );
}

function StationCombobox({
  label,
  selectedId,
  nearbyStationId,
  recentIds,
  inputRef,
  locationStatus,
  onRetryLocation,
  onSelect,
}: {
  label: string;
  selectedId: string | null;
  nearbyStationId: string | null;
  recentIds: string[];
  inputRef?: React.RefObject<HTMLInputElement>;
  locationStatus: "loading" | "granted" | "fallback";
  onRetryLocation: () => void;
  onSelect: (id: string | null) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [query, setQuery] = useState(selectedId ? STATIONS[selectedId].name : "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectingOptionRef = useRef(false);
  const [selectionError, setSelectionError] = useState(false);
  const preserveQueryRef = useRef(false);
  const lastSelectedRef = useRef<SubwayStation | null>(selectedId ? STATIONS[selectedId] : null);
  const errorId = `${inputId}-error`;

  useEffect(() => {
    if (!selectedId && preserveQueryRef.current) {
      preserveQueryRef.current = false;
      return;
    }
    lastSelectedRef.current = selectedId ? STATIONS[selectedId] : null;
    setQuery(selectedId ? STATIONS[selectedId].name : "");
    if (selectedId) setSelectionError(false);
  }, [selectedId]);

  const suggestions = useMemo(() => {
    if (query.trim()) return searchStations(query, 8);
    const ids = [nearbyStationId, ...recentIds, ...POPULAR_STATIONS].filter((id): id is string => Boolean(id));
    return [...new Set(ids)].map((id) => STATIONS[id]).filter(Boolean).slice(0, 8);
  }, [nearbyStationId, query, recentIds]);

  useEffect(() => setActiveIndex(-1), [query, open]);
  useEffect(() => {
    if (!open || activeIndex < 0 || !suggestions[activeIndex]) return;
    document.getElementById(`${listId}-${suggestions[activeIndex].id}`)?.scrollIntoView({
      behavior: scrollBehavior(),
      block: "nearest",
      inline: "nearest",
    });
  }, [activeIndex, listId, open, suggestions]);

  const commit = (station: SubwayStation) => {
    lastSelectedRef.current = station;
    onSelect(station.id);
    setQuery(station.name);
    setSelectionError(false);
    setOpen(false);
  };

  const finishEditing = () => {
    if (selectedId || !query.trim()) {
      setSelectionError(false);
      setOpen(false);
      return;
    }
    const exact = exactStationMatch(query);
    if (exact) {
      commit(exact);
      return;
    }
    setSelectionError(true);
    setOpen(false);
  };

  return (
    <div
      className="station-combobox"
      onBlur={(event) => {
        if (selectingOptionRef.current) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) finishEditing();
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="station-search-input">
        <Icon name="search" size="xs" />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 && suggestions[activeIndex] ? `${listId}-${suggestions[activeIndex].id}` : undefined}
          aria-describedby={selectionError ? errorId : undefined}
          aria-invalid={selectionError || undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search station"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectionError(false);
            if (selectedId) {
              preserveQueryRef.current = true;
              onSelect(null);
            }
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => index <= 0 ? Math.max(suggestions.length - 1, 0) : index - 1);
            } else if (event.key === "Enter" && open && suggestions[Math.max(activeIndex, 0)]) {
              event.preventDefault();
              commit(suggestions[Math.max(activeIndex, 0)]);
            } else if (event.key === "Escape") {
              event.preventDefault();
              const previous = lastSelectedRef.current;
              if (previous) commit(previous);
              else {
                setQuery("");
                setSelectionError(false);
                setOpen(false);
                onSelect(null);
              }
            }
          }}
        />
        {query && open && (
          <button
            type="button"
            className="station-search-clear"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              setQuery("");
              setSelectionError(false);
              lastSelectedRef.current = null;
              onSelect(null);
              setOpen(true);
              requestAnimationFrame(() => inputRef?.current?.focus());
            }}
          >
            <Icon name="x" size="xs" />
          </button>
        )}
      </div>

      {open && (
        <div className="station-search-results">
          <div className="station-results-label">
            {query.trim()
              ? "Best matches"
              : nearbyStationId
                ? "Near you, recent and popular"
                : recentIds.length > 0
                  ? "Recent and popular"
                  : "Popular stations"}
          </div>
          {!query.trim() && locationStatus === "loading" && (
            <div className="station-location-note" role="status">Finding a nearby station...</div>
          )}
          {!query.trim() && locationStatus === "fallback" && (
            <div className="station-location-note">
              <span>Location is unavailable. Showing popular stations.</span>
              <button type="button" onClick={onRetryLocation}>Retry</button>
            </div>
          )}
          {!query.trim() && locationStatus === "granted" && !nearbyStationId && (
            <div className="station-location-note">No station is within 2 km. Showing popular stations.</div>
          )}
          <div id={listId} className="station-result-options" role="listbox" aria-label={`${label} station results`}>
            {suggestions.length === 0 ? (
              <div className="station-no-results">No stations match &quot;{query.trim()}&quot;.</div>
            ) : (
              suggestions.map((station, index) => {
                const context = station.id === nearbyStationId
                  ? "Near you"
                  : recentIds.includes(station.id)
                    ? "Recent"
                    : null;
                return (
                  <button
                    type="button"
                    key={station.id}
                    id={`${listId}-${station.id}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selectedId === station.id}
                    className={index === activeIndex ? "active" : ""}
                    onPointerMove={() => setActiveIndex(index)}
                    onPointerDown={(event) => {
                      if (event.button === 0) selectingOptionRef.current = true;
                    }}
                    onPointerCancel={() => { selectingOptionRef.current = false; }}
                    onClick={() => {
                      selectingOptionRef.current = false;
                      commit(station);
                    }}
                  >
                    <StationLineBadges station={station} />
                    <span className="station-result-name">
                      <b>{station.name}</b>
                      <span lang="ko">{station.nameKr}</span>
                    </span>
                    {context && (
                      <span className="station-result-context">
                        <Icon name={context === "Recent" ? "history" : "locate"} size="sm" />
                        <span className="sr-only">{context}</span>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <span className="sr-only" aria-live="polite">{suggestions.length} station results</span>
        </div>
      )}
      {selectionError && <p id={errorId} className="station-field-error" role="alert">Select a station from the list.</p>}
    </div>
  );
}

const CATEGORY_OPTIONS: { key: SubwayPlaceCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "beauty", label: "Beauty" },
  { key: "olive_young", label: "Olive Young" },
  { key: "personal_color", label: "Personal Color" },
  { key: "mall", label: "Mall & Gifts" },
  { key: "daiso", label: "Daiso" },
];

function radiusLabel(radiusKm: number) {
  return radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`;
}

export function SubwayRouteController({
  departureId,
  arrivalId,
  viaIds,
  route,
  activeStationId,
  nearbyStationId,
  radiusKm,
  category,
  places,
  selectedPlaceId,
  onDeparture,
  onArrival,
  onVias,
  onStation,
  onRadius,
  onCategory,
  onPlace,
  onClearRoute,
  onEditingChange,
  onSnapChange,
  locationStatus,
  onRetryLocation,
  onClose,
}: {
  departureId: string | null;
  arrivalId: string | null;
  viaIds: string[];
  route: SubwayRoute | null;
  activeStationId: string | null;
  nearbyStationId: string | null;
  radiusKm: number;
  category: SubwayPlaceCategory;
  places: Place[];
  selectedPlaceId: string | null;
  onDeparture: (id: string | null) => void;
  onArrival: (id: string | null) => void;
  onVias: (ids: string[]) => void;
  onStation: (id: string | null) => void;
  onRadius: (radiusKm: number) => void;
  onCategory: (category: SubwayPlaceCategory) => void;
  onPlace: (id: string) => void;
  onClearRoute: () => void;
  onEditingChange: (editing: boolean) => void;
  onSnapChange: (snap: SubwaySnap) => void;
  locationStatus: "loading" | "granted" | "fallback";
  onRetryLocation: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(!route);
  const [snap, setSnap] = useState<SubwaySnap>("half");
  const [draftDeparture, setDraftDeparture] = useState(departureId);
  const [draftArrival, setDraftArrival] = useState(arrivalId);
  const [draftVias, setDraftVias] = useState<string[]>(viaIds);
  const [viaAdding, setViaAdding] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const selectedPlaceRef = useRef<HTMLDivElement>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);
  const arrivalInputRef = useRef<HTMLInputElement>(null);
  const viaInputRef = useRef<HTMLInputElement>(null);
  const routeButtonRef = useRef<HTMLButtonElement>(null);
  const routeSummaryRef = useRef<HTMLDivElement>(null);
  const nearbyControlsRef = useRef<HTMLDivElement>(null);
  const viaAddButtonRef = useRef<HTMLButtonElement>(null);
  const viaRowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingWaypointFocusRef = useRef<
    { kind: "departure" }
    | { kind: "arrival" }
    | { kind: "add" }
    | { kind: "via"; id: string }
    | null
  >(null);
  const pendingFocusRef = useRef<"search" | "route" | null>(null);
  const snapDragStart = useRef<{ y: number; snap: SubwaySnap } | null>(null);
  const snapDragMoved = useRef(false); // suppresses the native click that follows a drag release
  const [waypointAnnouncement, setWaypointAnnouncement] = useState("");

  useEffect(() => setRecentIds(readRecentStations()), []);
  useEffect(() => onEditingChange(editing), [editing, onEditingChange]);
  useEffect(() => {
    if (!editing && route) {
      setDraftDeparture(departureId);
      setDraftArrival(arrivalId);
      setDraftVias(viaIds);
    }
  }, [arrivalId, departureId, editing, route, viaIds]);
  useEffect(() => {
    if (!selectedPlaceId) return;
    selectedPlaceRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
  }, [selectedPlaceId]);
  useEffect(() => {
    if (pendingFocusRef.current === "search" && editing) {
      departureInputRef.current?.focus();
      pendingFocusRef.current = null;
    } else if (pendingFocusRef.current === "route" && !editing && route) {
      routeSummaryRef.current?.focus();
      pendingFocusRef.current = null;
    }
  }, [editing, route]);
  useEffect(() => {
    if (viaAdding) viaInputRef.current?.focus();
  }, [viaAdding]);
  useEffect(() => {
    const pending = pendingWaypointFocusRef.current;
    if (!pending) return;
    const target = pending.kind === "departure"
      ? departureInputRef.current
      : pending.kind === "arrival"
        ? arrivalInputRef.current
        : pending.kind === "add"
          ? viaAddButtonRef.current
          : viaRowRefs.current.get(pending.id) ?? null;
    if (!target) return;
    target.focus();
    pendingWaypointFocusRef.current = null;
  }, [draftArrival, draftDeparture, draftVias, viaAdding]);

  const remember = (id: string | null) => {
    if (!id) return;
    setRecentIds((current) => {
      const next = [id, ...current.filter((recentId) => recentId !== id)].slice(0, 4);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Search remains usable when browser storage is unavailable.
      }
      return next;
    });
  };

  const changeSnap = (next: SubwaySnap) => {
    setSnap(next);
    onSnapChange(next);
  };

  // Grip drag mirrors MapSheet: 40px threshold, click-to-cycle, Enter/Space.
  const onGripPointerDown = (event: React.PointerEvent) => {
    snapDragMoved.current = false;
    snapDragStart.current = { y: event.clientY, snap };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onGripPointerUp = (event: React.PointerEvent) => {
    if (!snapDragStart.current) return;
    const dy = event.clientY - snapDragStart.current.y;
    if (Math.abs(dy) > 40) snapDragMoved.current = true;
    const index = SNAP_ORDER.indexOf(snapDragStart.current.snap);
    if (dy < -40) changeSnap(SNAP_ORDER[Math.min(index + 1, SNAP_ORDER.length - 1)]);
    else if (dy > 40) changeSnap(SNAP_ORDER[Math.max(index - 1, 0)]);
    snapDragStart.current = null;
  };
  const cycleSnap = () => changeSnap(SNAP_ORDER[(SNAP_ORDER.indexOf(snap) + 1) % SNAP_ORDER.length]);
  const onGripClick = () => {
    if (snapDragMoved.current) {
      snapDragMoved.current = false;
      return;
    }
    cycleSnap();
  };
  const onGripKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    cycleSnap();
  };

  const draftRoute = useMemo(
    () => draftDeparture && draftArrival && draftDeparture !== draftArrival
      ? draftVias.length > 0
        ? findRouteVia(draftDeparture, draftVias, draftArrival)
        : findRoute(draftDeparture, draftArrival)
      : null,
    [draftArrival, draftDeparture, draftVias],
  );
  const sameStation = Boolean(draftDeparture && draftArrival && draftDeparture === draftArrival);
  const viaConflict = draftVias.some((id, index) =>
    id === draftDeparture || id === draftArrival || draftVias.indexOf(id) !== index);
  const routeUnavailable = Boolean(draftDeparture && draftArrival && !sameStation && !viaConflict && !draftRoute);
  const canApplyRoute = Boolean(draftDeparture && draftArrival && draftRoute && !sameStation && !viaConflict);
  const routeHelp = !draftDeparture
    ? "Choose a departure station."
    : !draftArrival
      ? "Choose an arrival station."
      : sameStation
        ? "Departure and arrival must be different stations."
        : viaConflict
          ? "Choose different departure, arrival, and via stations."
          : "No subway route is available for these stations.";
  const readyRoute = route && !editing ? route : null;
  const externalActiveIndex = readyRoute && activeStationId
    ? readyRoute.stations.indexOf(activeStationId)
    : -1;
  const activeIndex = readyRoute
    ? readyRoute.stations[activeRouteIndex] === activeStationId
      ? activeRouteIndex
      : externalActiveIndex >= 0
        ? externalActiveIndex
        : 0
    : -1;
  const activeId = readyRoute
    ? readyRoute.stations[activeIndex]
    : activeStationId && STATIONS[activeStationId]
      ? activeStationId
      : null;
  const previousId = readyRoute && activeIndex > 0 ? readyRoute.stations[activeIndex - 1] : null;
  const nextId = readyRoute && activeIndex >= 0 && activeIndex < readyRoute.stations.length - 1 ? readyRoute.stations[activeIndex + 1] : null;
  const activeStation = activeId ? STATIONS[activeId] : null;
  const segmentStarts = readyRoute ? routeSegmentStartIndices(readyRoute) : [];
  const segmentForHop = (hopIndex: number) => readyRoute?.segments.find((segment, index) =>
    segmentStarts[index] <= hopIndex
    && hopIndex < segmentStarts[index] + segment.stations.length - 1) ?? null;
  const incomingSegment = readyRoute && activeIndex > 0 ? segmentForHop(activeIndex - 1) : null;
  const outgoingSegment = readyRoute && activeIndex < readyRoute.stations.length - 1 ? segmentForHop(activeIndex) : null;
  const activeSegment = outgoingSegment ?? incomingSegment;
  const activeColor = activeSegment ? LINE_META[activeSegment.line].color : "var(--accent)";
  const activeText = activeSegment ? lineTextColor(activeColor) : "#FFFFFF";
  const leftColor = incomingSegment ? LINE_META[incomingSegment.line].color : activeColor;
  const rightColor = outgoingSegment ? LINE_META[outgoingSegment.line].color : activeColor;
  const leftText = incomingSegment ? lineTextColor(leftColor) : activeText;
  const rightText = outgoingSegment ? lineTextColor(rightColor) : activeText;

  useEffect(() => {
    if (readyRoute && activeRouteIndex !== activeIndex) {
      setActiveRouteIndex(activeIndex);
    }
  }, [activeIndex, activeRouteIndex, readyRoute]);

  const selectRouteIndex = (index: number) => {
    const id = readyRoute?.stations[index];
    if (!id) return;
    setActiveRouteIndex(index);
    onStation(id);
  };

  const openEditor = () => {
    pendingFocusRef.current = "search";
    setDraftDeparture(departureId);
    setDraftArrival(arrivalId);
    setDraftVias(viaIds);
    setViaAdding(false);
    setEditing(true);
    onEditingChange(true);
  };

  const cancelEditor = () => {
    pendingFocusRef.current = "route";
    setDraftDeparture(departureId);
    setDraftArrival(arrivalId);
    setDraftVias(viaIds);
    setViaAdding(false);
    setEditing(false);
    onEditingChange(false);
    const restoreId = activeStationId && route?.stations.includes(activeStationId) ? activeStationId : departureId;
    if (restoreId) onStation(restoreId);
  };

  const applyRoute = () => {
    if (!draftDeparture || !draftArrival || !draftRoute || sameStation || viaConflict) return;
    pendingFocusRef.current = "route";
    onVias(draftVias);
    onArrival(draftArrival);
    onDeparture(draftDeparture);
    setViaAdding(false);
    setEditing(false);
    onEditingChange(false);
    changeSnap("half");
  };

  const clearRoute = () => {
    pendingFocusRef.current = "search";
    setDraftDeparture(null);
    setDraftArrival(null);
    setDraftVias([]);
    setViaAdding(false);
    setEditing(true);
    onEditingChange(true);
    onClearRoute();
    changeSnap("half");
  };

  const moveDraftWaypoint = (index: number, direction: -1 | 1) => {
    if (!draftDeparture || !draftArrival) return;
    const current = [draftDeparture, ...draftVias, draftArrival];
    const movingId = current[index];
    const targetIndex = index + direction;
    const ordered = moveRouteWaypoint(
      current,
      index,
      direction,
    );
    pendingWaypointFocusRef.current = targetIndex === 0
      ? { kind: "departure" }
      : targetIndex === ordered.length - 1
        ? { kind: "arrival" }
        : { kind: "via", id: movingId };
    setDraftDeparture(ordered[0]);
    setDraftVias(ordered.slice(1, -1));
    setDraftArrival(ordered[ordered.length - 1]);
    const position = targetIndex === 0
      ? "departure"
      : targetIndex === ordered.length - 1
        ? "arrival"
        : `via ${targetIndex}`;
    setWaypointAnnouncement(`${STATIONS[movingId].name} moved to ${position}.`);
    onStation(ordered[targetIndex]);
  };

  const removeDraftVia = (index: number) => {
    const removedId = draftVias[index];
    const remaining = draftVias.filter((_, viaIndex) => viaIndex !== index);
    const nextFocusId = remaining[index] ?? remaining[index - 1];
    pendingWaypointFocusRef.current = nextFocusId
      ? { kind: "via", id: nextFocusId }
      : { kind: "arrival" };
    setDraftVias(remaining);
    setWaypointAnnouncement(`${STATIONS[removedId].name} removed from the route.`);
  };

  const showNearby = () => {
    nearbyControlsRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    window.requestAnimationFrame(() => nearbyControlsRef.current?.focus({ preventScroll: true }));
  };

  // "지하철 역 눌렀을때": a focused mid-route station can become a via (경유역),
  // inserted in leg order so the recomputed route keeps the travel direction.
  const canAddActiveVia = Boolean(
    readyRoute && activeId && viaIds.length < MAX_VIAS
    && activeId !== readyRoute.stations[0]
    && activeId !== readyRoute.stations[readyRoute.stations.length - 1]
    && !viaIds.includes(activeId),
  );
  const addActiveVia = () => {
    if (!readyRoute || !activeId || !canAddActiveVia) return;
    const next = [
      ...viaIds.map((id) => ({ id, index: readyRoute.stations.indexOf(id) })),
      { id: activeId, index: activeIndex },
    ]
      .sort((a, b) => a.index - b.index)
      .map(({ id }) => id);
    onVias(next);
    setWaypointAnnouncement(`${STATIONS[activeId].name} added as a via station.`);
    requestAnimationFrame(() => routeSummaryRef.current?.focus());
  };

  const rankedPlaces = useMemo(() => {
    if (!activeStation) return [];
    return places
      .map((place) => ({
        place,
        km: haversineKm(activeStation, { lat: place.lat, lng: place.lng }),
      }))
      .sort((a, b) => a.km - b.km || (b.place.rating ?? 0) - (a.place.rating ?? 0));
  }, [activeStation, places]);

  const oliveYoungPicks = useMemo(
    () => PRODUCTS.filter((product) => product.channel === "olive_young").sort((a, b) => a.salesRank - b.salesRank).slice(0, 3),
    [],
  );

  const routeTitle = route && !editing
    ? [route.stations[0], ...viaIds, route.stations[route.stations.length - 1]]
        .map((id) => (STATIONS[id] ? stationDisplayName(STATIONS[id]) : null))
        .filter(Boolean)
        .join(" → ")
    : null;

  return (
    <section
      className={`subway-controller${readyRoute ? ` route-ready snap-${snap}` : " search-ready"}`}
      aria-label="Plan by subway stations"
    >
      {readyRoute && (
        <div
          className="subway-snap-handle"
          role="button"
          tabIndex={0}
          aria-label={`Route panel — ${snap === "compact" ? "expand" : "drag or press to resize"}`}
          onPointerDown={onGripPointerDown}
          onPointerUp={onGripPointerUp}
          onPointerCancel={() => { snapDragStart.current = null; }}
          onClick={onGripClick}
          onKeyDown={onGripKeyDown}
        >
          <span className="mapsheet-grip" aria-hidden="true" />
        </div>
      )}

      {!(readyRoute && snap === "compact") && (
        <header className="subway-controller-header">
          <div>
            <span className="subway-controller-kicker"><Icon name="train" size="xs" /> Subway</span>
            <h2 title={routeTitle ?? undefined}>{routeTitle ?? "Choose your route"}</h2>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {route && !editing && (
              <button type="button" className="subway-text-action" onClick={openEditor}>Edit</button>
            )}
            <IconButton name="x" label="Close subway planner" iconSize="xs" onClick={onClose} />
          </div>
        </header>
      )}

      {readyRoute && activeStation && activeId && (
        <>
          {/* Ticket-style summary: endpoints at the edges, travel time in a
              pill on a dotted connector (train-ticket reference, 2026-08-02). */}
          <div ref={routeSummaryRef} className="subway-route-summary" tabIndex={-1} aria-live="polite">
            <div className="subway-ticket-ends">
              <b>{stationDisplayName(STATIONS[readyRoute.stations[0]])}</b>
              <b>{stationDisplayName(STATIONS[readyRoute.stations[readyRoute.stations.length - 1]])}</b>
            </div>
            <div className="subway-ticket-line" aria-hidden="true">
              {/* endpoint dots wear their segment's line color */}
              <i className="dot" style={{ background: LINE_META[readyRoute.segments[0].line].color }} />
              <i className="dash" />
              <span className="pill">{travelMinutes(readyRoute)} min</span>
              <i className="dash" />
              <i className="dot" style={{ background: LINE_META[readyRoute.segments[readyRoute.segments.length - 1].line].color }} />
            </div>
            <div className="subway-ticket-meta">
              <span>
                {readyRoute.segments.length === 1 ? "Direct" : `${readyRoute.segments.length - 1} transfer${readyRoute.segments.length > 2 ? "s" : ""}`}
                {" · "}{readyRoute.stations.length - 1} stops
              </span>
              <a
                className="subway-live-pill"
                href={googleDirectionsUrl(STATIONS[readyRoute.stations[readyRoute.stations.length - 1]], STATIONS[readyRoute.stations[0]])}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Check live transit directions in Google Maps"
                title="Check live transit directions in Google Maps"
              >
                <Icon name="ext" size="xs" /> Live
              </a>
              {snap !== "compact" && (
                <button
                  type="button"
                  className="subway-nearby-jump"
                  aria-label="Show nearby places"
                  title="Show nearby places"
                  onClick={showNearby}
                >
                  <Icon name="pin" size="xs" /> <span>Nearby</span>
                </button>
              )}
            </div>
          </div>
          {snap === "compact" && (
            <div className="subway-compact-station">
              <Icon name="train" size="xs" />
              <b title={activeStation.name}>{stationDisplayName(activeStation)}</b>
              <span lang="ko">{activeStation.nameKr}</span>
            </div>
          )}
        </>
      )}

      <div className="subway-controller-scroll">
        {editing || !route ? (
          <div className="subway-search-panel">
            <div className="subway-search-fields">
              <span className="subway-search-route-rail" aria-hidden="true">
                <RailStop stationId={draftDeparture} kind="departure" />
                {draftVias.map((id) => (
                  <Fragment key={id}>
                    <span className="subway-route-connector" />
                    <RailStop stationId={id} kind="via" />
                  </Fragment>
                ))}
                {viaAdding && (
                  <>
                    <span className="subway-route-connector" />
                    <span className="subway-route-dot via pending" />
                  </>
                )}
                <span className="subway-route-connector" />
                <RailStop stationId={draftArrival} kind="arrival" />
              </span>
              <div className="subway-search-field-stack">
                <StationCombobox
                  label="Departure"
                  selectedId={draftDeparture}
                  nearbyStationId={nearbyStationId}
                  recentIds={recentIds}
                  inputRef={departureInputRef}
                  locationStatus={locationStatus}
                  onRetryLocation={onRetryLocation}
                  onSelect={(id) => {
                    setDraftDeparture(id);
                    remember(id);
                    onStation(id ?? draftArrival);
                    if (id) requestAnimationFrame(() => arrivalInputRef.current?.focus());
                  }}
                />
                {draftVias.map((id, index) => (
                  <div
                    key={id}
                    ref={(node) => {
                      if (node) viaRowRefs.current.set(id, node);
                      else viaRowRefs.current.delete(id);
                    }}
                    className="subway-waypoint-row"
                    role="group"
                    tabIndex={-1}
                    aria-label={`Via ${index + 1}: ${STATIONS[id].name}`}
                  >
                    <div className="subway-waypoint-field">
                      <span>{`Via ${index + 1}`}</span>
                      <b title={STATIONS[id].name}>{STATIONS[id].name}</b>
                      <button
                        type="button"
                        className="station-search-clear"
                        aria-label={`Remove via station ${STATIONS[id].name}`}
                        title={`Remove ${STATIONS[id].name}`}
                        onClick={() => removeDraftVia(index)}
                      >
                        <Icon name="x" size="xs" />
                      </button>
                    </div>
                    <div className="subway-waypoint-order" role="group" aria-label={`Position ${STATIONS[id].name} in route`}>
                      <button
                        type="button"
                        aria-label={`Move ${STATIONS[id].name} toward departure`}
                        title="Move toward departure"
                        disabled={!draftDeparture || !draftArrival}
                        onClick={() => moveDraftWaypoint(index + 1, -1)}
                      >
                        <Icon name="chev" size="xs" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${STATIONS[id].name} toward arrival`}
                        title="Move toward arrival"
                        disabled={!draftDeparture || !draftArrival}
                        onClick={() => moveDraftWaypoint(index + 1, 1)}
                      >
                        <Icon name="chev" size="xs" />
                      </button>
                    </div>
                  </div>
                ))}
                {viaAdding && (
                  <div className="subway-waypoint-row adding">
                    <StationCombobox
                      label={`Via ${draftVias.length + 1}`}
                      selectedId={null}
                      nearbyStationId={nearbyStationId}
                      recentIds={recentIds}
                      inputRef={viaInputRef}
                      locationStatus={locationStatus}
                      onRetryLocation={onRetryLocation}
                      onSelect={(id) => {
                        if (!id) return;
                        pendingWaypointFocusRef.current = { kind: "via", id };
                        setDraftVias((current) => current.includes(id) ? current : [...current, id]);
                        setViaAdding(false);
                        setWaypointAnnouncement(`${STATIONS[id].name} added as a via station.`);
                        remember(id);
                        onStation(id);
                      }}
                    />
                    <button
                      type="button"
                      className="subway-waypoint-cancel"
                      aria-label="Cancel adding a via station"
                      title="Cancel adding a via station"
                      onClick={() => {
                        pendingWaypointFocusRef.current = { kind: "add" };
                        setViaAdding(false);
                        setWaypointAnnouncement("Adding a via station cancelled.");
                      }}
                    >
                      <Icon name="x" size="xs" />
                    </button>
                  </div>
                )}
                <StationCombobox
                  label="Arrival"
                  selectedId={draftArrival}
                  nearbyStationId={nearbyStationId}
                  recentIds={recentIds}
                  inputRef={arrivalInputRef}
                  locationStatus={locationStatus}
                  onRetryLocation={onRetryLocation}
                  onSelect={(id) => {
                    setDraftArrival(id);
                    remember(id);
                    onStation(id ?? draftDeparture);
                    if (id) requestAnimationFrame(() => routeButtonRef.current?.focus());
                  }}
                />
              </div>
              <button
                type="button"
                className="subway-swap-button"
                aria-label="Swap departure and arrival"
                title="Swap departure and arrival"
                disabled={!draftDeparture && !draftArrival}
                onClick={() => {
                  setDraftDeparture(draftArrival);
                  setDraftArrival(draftDeparture);
                  setDraftVias((current) => [...current].reverse());
                  const focusId = draftArrival ?? draftDeparture;
                  if (focusId) onStation(focusId);
                }}
              >
                <Icon name="swap" size="sm" />
              </button>
            </div>

            <div className="subway-via-editor">
              {!viaAdding && draftVias.length < MAX_VIAS ? (
                <button
                  ref={viaAddButtonRef}
                  type="button"
                  className="subway-via-add"
                  onClick={() => setViaAdding(true)}
                >
                  <Icon name="plus" size="xs" /> Add via station
                </button>
              ) : null}
            </div>

            {sameStation && <p className="station-search-error" role="alert">Departure and arrival must be different stations.</p>}
            {viaConflict && <p className="station-search-error" role="alert">Via stations must be different from departure, arrival, and each other.</p>}
            {routeUnavailable && <p className="station-search-error" role="alert">A route could not be found between these stations.</p>}
            {activeStation && (!draftDeparture || !draftArrival) && (
              <div className="subway-search-preview">
                <div className="subway-nearby-heading">
                  <div>
                    <h3>Near {activeStation.name}</h3>
                    <p>{radiusLabel(radiusKm)} straight-line radius from the station center</p>
                  </div>
                  <span className="mono">{rankedPlaces.length}</span>
                </div>
                {rankedPlaces.length > 0 ? (
                  <div className="subway-place-list">
                    {rankedPlaces.slice(0, 3).map(({ place, km }) => (
                      <div
                        key={place.id}
                        ref={selectedPlaceId === place.id ? selectedPlaceRef : undefined}
                        className={`subway-place-row compact${selectedPlaceId === place.id ? " selected" : ""}`}
                      >
                        <button type="button" onClick={() => onPlace(place.id)} aria-current={selectedPlaceId === place.id ? "true" : undefined}>
                          <CategoryBadge type={place.type} size={20} />
                          <span className="subway-place-copy">
                            <b>{place.name}</b>
                            <span>{TYPE_LABEL[place.type]} · {formatDistance(km)} straight-line from station center</span>
                          </span>
                        </button>
                        <Link href={routes.place(place.id)} aria-label={`View ${place.name} details`}>
                          <Icon name="chev" size="xs" />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="subway-search-preview-empty">No places are listed around this station in our current data.</p>
                )}
              </div>
            )}
          </div>
        ) : readyRoute && activeStation && activeId && snap !== "compact" ? (
          <>
            {snap === "full" && (
              <div className="subway-route-steps" aria-label="Route steps">
                {readyRoute.segments.map((segment, index) => {
                  const line = LINE_META[segment.line];
                  return (
                    <span className="subway-route-leg" key={`${segment.line}-${index}`}>
                      <i className="linebadge" style={{ background: line.color, color: lineTextColor(line.color) }}>{line.shortLabel}</i>
                      {/* One line per leg — the strip below already draws the
                          station-by-station detail this small print repeated. */}
                      <span>
                        <b>{index === 0
                          ? `Take ${line.label}`
                          : `At ${STATIONS[segment.stations[0]].name}, transfer to ${line.label}`}</b>
                      </span>
                    </span>
                  );
                })}
                <span className="subway-route-arrival"><b>Arrive</b> {STATIONS[readyRoute.stations[readyRoute.stations.length - 1]].name}</span>
              </div>
            )}

            <div
              className="subway-station-focus"
              style={{
                "--station-line": activeColor,
                "--station-line-left": leftColor,
                "--station-line-right": rightColor,
                "--station-text-left": leftText,
                "--station-text-right": rightText,
                "--station-shadow-left": leftText === "#FFFFFF" ? "0 1px 2px rgba(15, 23, 42, 0.42)" : "none",
                "--station-shadow-right": rightText === "#FFFFFF" ? "0 1px 2px rgba(15, 23, 42, 0.42)" : "none",
              } as React.CSSProperties}
            >
              <button type="button" disabled={!previousId} aria-label={previousId ? `Previous station: ${STATIONS[previousId].name}` : "Departure"} onClick={() => previousId && selectRouteIndex(activeIndex - 1)}>
                <Icon name="back" size="xs" />
                <span>{previousId ? stationDisplayName(STATIONS[previousId]) : "Departure"}</span>
              </button>
              <div className="subway-active-station">
                <b title={activeStation.name} aria-label={activeStation.name}>{stationDisplayName(activeStation)}</b>
                <span lang="ko">{activeStation.nameKr}</span>
              </div>
              <button type="button" disabled={!nextId} aria-label={nextId ? `Next station: ${STATIONS[nextId].name}` : "Arrival"} onClick={() => nextId && selectRouteIndex(activeIndex + 1)}>
                <span>{nextId ? stationDisplayName(STATIONS[nextId]) : "Arrival"}</span>
                <Icon name="chev" size="xs" />
              </button>
            </div>

            {snap === "full" && (
              <RouteStrip
                route={readyRoute}
                activeIndex={activeIndex}
                embedded
                onStation={selectRouteIndex}
                onClear={clearRoute}
              />
            )}

            <div ref={nearbyControlsRef} className="subway-nearby-controls" tabIndex={-1}>
              <div className="subway-segmented" role="group" aria-label="Nearby radius">
                {[0.5, 1, 2].map((radius) => (
                  <button key={radius} type="button" aria-pressed={radiusKm === radius} onClick={() => onRadius(radius)}>
                    {radiusLabel(radius)}
                  </button>
                ))}
              </div>
              <div className="subway-category-tabs" role="group" aria-label="Nearby place category">
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={category === option.key}
                    onClick={() => onCategory(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="subway-nearby-heading">
              <div>
                <h3>Near {activeStation.name}</h3>
                <p>{radiusLabel(radiusKm)} straight-line radius from the station center</p>
              </div>
              {canAddActiveVia && (
                <button
                  type="button"
                  className="subway-via-add inline"
                  onClick={addActiveVia}
                  aria-label={`Add ${activeStation.name} as a via station`}
                >
                  <Icon name="plus" size="xs" /> Add as via
                </button>
              )}
              <span className="mono">{rankedPlaces.length}</span>
            </div>

            {rankedPlaces.length > 0 ? (
              <div className="subway-place-list">
                {rankedPlaces.map(({ place, km }) => (
                  <div
                    key={place.id}
                    ref={selectedPlaceId === place.id ? selectedPlaceRef : undefined}
                    className={`subway-place-row${selectedPlaceId === place.id ? " selected" : ""}`}
                  >
                    <button type="button" onClick={() => onPlace(place.id)} aria-current={selectedPlaceId === place.id ? "true" : undefined}>
                      <CategoryBadge type={place.type} size={20} />
                      <span className="subway-place-copy">
                        <b>{place.name}</b>
                        <span>{TYPE_LABEL[place.type]} · {formatDistance(km)} straight-line from station center</span>
                        <span><RatingLine rating={place.rating} count={place.ratingCount} plain />{place.englishOk ? " · English support reported" : ""}</span>
                      </span>
                    </button>
                    <Link href={routes.place(place.id)} aria-label={`View ${place.name} details`}>
                      <Icon name="chev" size="xs" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : category === "daiso" ? (
              <div className="subway-empty-state" role="status">
                <b>Daiso location data is not connected yet</b>
                <p>Search around {activeStation.name} Station in Naver Map.</p>
                <Button
                  size="sm"
                  className="auto"
                  href={naverMapUrl(`다이소 ${activeStation.nameKr}역`)}
                  external
                >
                  Search Naver Map
                </Button>
              </div>
            ) : (
              <div className="subway-empty-state" role="status">
                <b>No {category === "all" ? "places" : category === "beauty" ? "beauty places" : "Olive Young stores"} in our current data</b>
                <p>Nothing is listed within {radiusLabel(radiusKm)} of {activeStation.name} Station.</p>
                <div className="row" style={{ gap: 8, justifyContent: "center" }}>
                  {radiusKm < 2 && <Button variant="secondary" size="sm" onClick={() => onRadius(2)}>Expand to 2 km</Button>}
                  {category !== "all" && <Button variant="secondary" size="sm" onClick={() => onCategory("all")}>Show all</Button>}
                </div>
              </div>
            )}

            {category === "olive_young" && (
              <section className="subway-product-picks">
                <div className="subway-nearby-heading">
                  <div>
                    <h3>Products to look for</h3>
                    <p>Store-level stock is not available here.</p>
                  </div>
                </div>
                {oliveYoungPicks.map((product) => (
                  <Link key={product.id} href={routes.shopItem(product.id)}>
                    <span>{product.brand}</span>
                    <b>{product.name}</b>
                    <span className="mono">{product.priceRange}</span>
                    <Icon name="chev" size="xs" />
                  </Link>
                ))}
              </section>
            )}
          </>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">{waypointAnnouncement}</span>
      {(editing || !route) && (
        <div className="subway-search-actions subway-search-footer">
          {!canApplyRoute && <p id="subway-route-help" className="subway-action-help">{routeHelp}</p>}
          {route && <Button variant="secondary" onClick={cancelEditor}>Cancel</Button>}
          <Button
            buttonRef={routeButtonRef}
            disabled={!canApplyRoute}
            aria-describedby={!canApplyRoute ? "subway-route-help" : undefined}
            onClick={applyRoute}
          >
            {route ? "Update route" : "Show route"}
          </Button>
        </div>
      )}
    </section>
  );
}
