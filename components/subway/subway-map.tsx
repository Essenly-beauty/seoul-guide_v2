"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { LINE_META, LINE_STATIONS, STATIONS, shopCount, type LineId } from "@/lib/subway";
import type { Place } from "@/lib/data";

export function SubwayMap({ places, departure, arrival, onSetDeparture, onSetArrival }: {
  places: Place[];
  departure: string | null;
  arrival: string | null;
  onSetDeparture: (id: string) => void;
  onSetArrival: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const pickedStation = picked ? STATIONS[picked] : null;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of Object.keys(STATIONS)) m.set(id, shopCount(places, id));
    return m;
  }, [places]);

  return (
    <div className="subwaywrap">
      <svg viewBox="0 0 720 560" role="img" aria-label="Seoul subway schematic (simplified)">
        {(Object.entries(LINE_STATIONS) as [LineId, string[]][]).map(([line, ids]) => (
          <polyline
            key={line}
            points={ids.map((id) => `${STATIONS[id].x},${STATIONS[id].y}`).join(" ")}
            fill="none" stroke={LINE_META[line].color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.85}
          />
        ))}
        {Object.values(STATIONS).map((s) => {
          const state = s.id === departure ? "dep" : s.id === arrival ? "arr" : s.id === picked ? "picked" : "";
          const n = counts.get(s.id) ?? 0;
          return (
            <g
              key={s.id}
              className={`substation ${state}`}
              onClick={() => setPicked(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPicked(s.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${s.name} station${n > 0 ? `, ${n} shops nearby` : ""}`}
              style={{ cursor: "pointer" }}
            >
              <circle cx={s.x} cy={s.y} r={s.lines.length > 1 ? 9 : 7} />
              <text x={s.x} y={s.y - 14} textAnchor="middle">{s.name}</text>
              {n > 0 && (
                <g>
                  <circle className="countbadge" cx={s.x + 13} cy={s.y - 11} r={8} />
                  <text className="countnum" x={s.x + 13} y={s.y - 8} textAnchor="middle">{n}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {pickedStation && (
        <div className="substation-card" role="dialog" aria-label={`${pickedStation.name} station`}>
          <div className="row between">
            <div>
              <div className="row" style={{ gap: 6 }}>
                {pickedStation.lines.map((l) => (
                  <span key={l} className="linebadge" style={{ background: LINE_META[l].color }}>{LINE_META[l].shortLabel}</span>
                ))}
                <b>{pickedStation.name}</b>
              </div>
              <div className="caption muted">{pickedStation.nameKr} · {counts.get(pickedStation.id) ?? 0} shops nearby</div>
            </div>
            <button className="iconbtn" aria-label="Close" onClick={() => setPicked(null)}><Icon name="x" size="sm" /></button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => { onSetDeparture(pickedStation.id); setPicked(null); }}>
              {departure === pickedStation.id ? "✓ " : ""}Departure
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => { onSetArrival(pickedStation.id); setPicked(null); }}>
              {arrival === pickedStation.id ? "✓ " : ""}Arrival
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
