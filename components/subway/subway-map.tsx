"use client";

// Placeholder while the metropolitan schematic SVG (Task S4) replaces this
// component. Props are kept so map-screen.tsx compiles unchanged in the meantime.
import type { Place } from "@/lib/data";

export function SubwayMap(_props: {
  places: Place[];
  departure: string | null;
  arrival: string | null;
  onSetDeparture: (id: string) => void;
  onSetArrival: (id: string) => void;
}) {
  return (
    <div className="subwaywrap">
      <p className="small muted" style={{ padding: 24, textAlign: "center" }}>Upgrading map…</p>
    </div>
  );
}
