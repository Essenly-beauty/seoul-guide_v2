"use client";

import { useRef } from "react";
import { Icon } from "@/components/icon";
import { LINE_META, STATIONS, type SubwayRoute } from "@/lib/subway";

export function RouteStrip({ route, activeId, onStation, onClear }: {
  route: SubwayRoute;
  activeId: string | null;
  onStation: (id: string) => void;
  onClear: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="routestrip" role="group" aria-label="Subway route">
      <button className="iconbtn" aria-label="Scroll left" onClick={() => scrollBy(-160)}><Icon name="back" size="xs" /></button>
      <div className="routescroll" ref={scroller}>
        {route.segments.map((seg, si) => (
          <span key={`${seg.line}-${si}`} className="routeseg">
            <span className="linebadge" style={{ background: LINE_META[seg.line].color }}>{LINE_META[seg.line].label}</span>
            {seg.stations.map((id, i) => (
              // 환승역은 다음 세그먼트 첫 역과 중복 — 세그먼트 첫 역은 두 번째 세그먼트부터 생략
              (si === 0 || i > 0) && (
                <span key={id} className="routestation">
                  {i > 0 && <span className="dash" aria-hidden="true">–</span>}
                  <button className={activeId === id ? "on" : ""} aria-current={activeId === id ? "true" : undefined} onClick={() => onStation(id)}>{STATIONS[id].name}</button>
                </span>
              )
            ))}
          </span>
        ))}
      </div>
      <button className="iconbtn" aria-label="Scroll right" onClick={() => scrollBy(160)}><Icon name="chev" size="xs" /></button>
      <button className="iconbtn" aria-label="Clear route" onClick={onClear}><Icon name="x" size="xs" /></button>
    </div>
  );
}
