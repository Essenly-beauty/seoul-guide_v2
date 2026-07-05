"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { DirectionsLauncher } from "@/components/directions/directions-sheet";
import { routes } from "@/lib/routes";
import { TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { formatDistance, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";

type Snap = "peek" | "half" | "full";
const ORDER: Snap[] = ["peek", "half", "full"];

export function MapSheet({ places, origin, selectedId, onSelect, onClearSelection }: {
  places: Place[];
  origin: LatLng;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
}) {
  const [snap, setSnap] = useState<Snap>("peek");
  const dragStart = useRef<{ y: number; snap: Snap } | null>(null);

  const ranked = useMemo(
    () =>
      places
        .map((p) => ({ p, km: haversineKm(origin, { lat: p.lat, lng: p.lng }) }))
        .sort((a, b) => a.km - b.km),
    [places, origin],
  );
  const selected = ranked.find((r) => r.p.id === selectedId);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, snap };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const i = ORDER.indexOf(dragStart.current.snap);
    if (dy < -40) setSnap(ORDER[Math.min(i + 1, 2)]);
    else if (dy > 40) setSnap(ORDER[Math.max(i - 1, 0)]);
    dragStart.current = null;
  };

  return (
    <section className={`mapsheet ${selected ? "half" : snap}`} aria-label="Nearby places">
      <div
        className="mapsheet-handle"
        role="button"
        tabIndex={0}
        aria-label={`Places list — ${snap === "peek" ? "expand" : "drag or press to resize"}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={() => setSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSnap(snap === "peek" ? "half" : "peek"); } }}
      >
        <span className="mapsheet-grip" aria-hidden="true" />
        {!selected && <div className="small" style={{ fontWeight: 600 }}>{ranked.length} places near you</div>}
        {selected && (
          <button className="row small" style={{ gap: 4, color: "var(--muted)" }} onClick={(e) => { e.stopPropagation(); onClearSelection(); }}>
            <Icon name="back" size="xs" /> All places
          </button>
        )}
      </div>

      <div className="mapsheet-body">
        {selected ? (
          <div className="stack" style={{ paddingBottom: 12 }}>
            <div>
              <span className="label">{TYPE_LABEL[selected.p.type]} · {zoneShort(selected.p.zone)}</span>
              <h2 className="h2" style={{ marginTop: 2 }}>{selected.p.name}</h2>
              <div className="caption muted">{selected.p.nameKr}</div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              {selected.p.rating && <span className="rating">★ {selected.p.rating}</span>}
              <span className="chip mono">{selected.p.priceRange}</span>
              <span className="small muted">{formatDistance(selected.km)} · ~{walkMinutes(selected.km)} min walk</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn ghost" style={{ flex: 1 }} href={routes.place(selected.p.id)}>View details</Link>
              <DirectionsLauncher
                className="btn"
                place={{ name: selected.p.name, nameKr: selected.p.nameKr, address: selected.p.address, lat: selected.p.lat, lng: selected.p.lng }}
              />
            </div>
          </div>
        ) : (
          ranked.map(({ p, km }) => (
            <button key={p.id} className="maprow" onClick={() => onSelect(p.id)}>
              <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
                <Icon name="pin" size="sm" style={{ color: "var(--accent)" }} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="caption muted">
                  <span className="mono">{formatDistance(km)}</span> · ~{walkMinutes(km)} min walk
                  {p.rating && <> · <span className="stars">★ {p.rating}</span></>}
                  {p.englishOk && <> · English OK</>}
                </div>
              </div>
              <span className="chip mono" style={{ alignSelf: "center" }}>{p.priceRange}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
