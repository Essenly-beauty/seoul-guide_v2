"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PLACES, type PlaceType } from "@/lib/data";
import { MYEONGDONG } from "@/lib/geo";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-canvas hero-img" aria-label="Loading map" />,
});

const CATS: { key: "all" | PlaceType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "salon", label: "Hair" },
  { key: "spa", label: "Spa" },
  { key: "headspa", label: "Head Spa" },
  { key: "clinic", label: "Clinic" },
  { key: "spots", label: "Spots" },
];

export function MapScreen() {
  const [cat, setCat] = useState<"all" | PlaceType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const places = useMemo(() => (cat === "all" ? PLACES : PLACES.filter((p) => p.type === cat)), [cat]);

  return (
    <div className="map-screen">
      <MapView
        center={MYEONGDONG}
        places={places}
        selectedId={selectedId}
        onSelect={setSelectedId}
        userLoc={null}
        flyTarget={null}
        onUserMove={() => {}}
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
          {CATS.map((c) => (
            <button key={c.key} className={"chip" + (cat === c.key ? " selected" : "")} aria-pressed={cat === c.key} onClick={() => { setCat(c.key); setSelectedId(null); }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
