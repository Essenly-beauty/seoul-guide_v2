"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PLACES, MAP_CATEGORIES, type PlaceType } from "@/lib/data";
import { MYEONGDONG, type LatLng } from "@/lib/geo";
import { useLocation } from "./use-location";
import { MapSheet } from "./map-sheet";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-canvas hero-img" aria-label="Loading map" />,
});

export function MapScreen() {
  const [cat, setCat] = useState<"all" | PlaceType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { loc, status, retry } = useLocation();
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const centerRef = useRef(loc ?? MYEONGDONG); // 최초 마운트 center 고정용
  const [moved, setMoved] = useState(false);
  const [area, setArea] = useState<{ south: number; west: number; north: number; east: number } | null>(null);
  const boundsGetter = useRef<(() => { south: number; west: number; north: number; east: number }) | null>(null);

  const places = useMemo(() => {
    let list = cat === "all" ? PLACES : PLACES.filter((p) => p.type === cat);
    if (area) list = list.filter((p) => p.lat >= area.south && p.lat <= area.north && p.lng >= area.west && p.lng <= area.east);
    return list;
  }, [cat, area]);

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

      <div className="map-top">
        <div className="row" style={{ gap: 8 }}>
          <Link className="map-searchpill" href={routes.search}>
            <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
            <span className="small muted">Search studios, salons, clinics…</span>
          </Link>
          <Link className="iconbtn map-close" href={routes.home} aria-label="Close map"><Icon name="x" size="sm" /></Link>
        </div>
        <div className="chiprow" role="group" aria-label="Filter by category">
          {MAP_CATEGORIES.map((c) => (
            <button key={c.key} className={"chip" + (cat === c.key ? " selected" : "")} aria-pressed={cat === c.key} onClick={() => { setCat(c.key); setSelectedId(null); }}>
              {c.label}
            </button>
          ))}
        </div>
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

      <MapSheet
        places={places}
        origin={loc ?? MYEONGDONG}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClearSelection={() => setSelectedId(null)}
      />

      {status === "fallback" && !bannerDismissed && (
        <div className="map-banner" role="status">
          <span className="small">Location is off — showing <b>Myeongdong</b> as your starting point.</span>
          <button className="iconbtn" style={{ width: 32, height: 32 }} aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>
            <Icon name="x" size="xs" />
          </button>
        </div>
      )}
    </div>
  );
}
