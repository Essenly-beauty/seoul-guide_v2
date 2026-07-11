"use client";

import { useMemo, useRef } from "react";
import { Icon } from "@/components/icon";
import { LINE_META, STATIONS, travelMinutes, type SubwayRoute } from "@/lib/subway";

export function RouteStrip({ route, activeId, onStation, onClear }: {
  route: SubwayRoute;
  activeId: string | null;
  onStation: (id: string) => void;
  onClear: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  const transfers = route.segments.length - 1;
  const firstId = route.stations[0];
  const lastId = route.stations[route.stations.length - 1];
  // A transfer boundary is the station that closes one segment and opens the
  // next (deduped below so it's only rendered once, at the end of the
  // earlier segment).
  const transferIds = useMemo(
    () => new Set(route.segments.slice(0, -1).map((seg) => seg.stations[seg.stations.length - 1])),
    [route],
  );

  return (
    <div className="routestrip" role="group" aria-label="Subway route">
      <div className="routesummary">
        <b>~{travelMinutes(route)} min</b>
        <span aria-hidden="true">·</span>
        <span>{transfers === 0 ? "direct" : `${transfers} transfer${transfers > 1 ? "s" : ""}`}</span>
      </div>
      <div className="routestrip-controls">
        <button className="iconbtn" aria-label="Scroll left" onClick={() => scrollBy(-160)}><Icon name="back" size="xs" /></button>
        <div className="routescroll" ref={scroller}>
          {route.segments.map((seg, si) => {
            const lineColor = LINE_META[seg.line].color;
            return (
              // The bottom rail (border-bottom) is this segment's line-colored
              // "spine" — Kakao's timeline equivalent for a horizontal strip.
              // Station names stay dark; only the rail, dash connectors, and
              // badge carry the line color. Transfer stations sit right at the
              // boundary where one segment's rail ends and the next begins, so
              // no extra transfer styling is needed beyond the existing dot.
              <span key={`${seg.line}-${si}`} className="routeseg" style={{ borderBottomColor: lineColor }}>
                <span className="linebadge" style={{ background: lineColor }}>{LINE_META[seg.line].label}</span>
                {seg.stations.map((id, i) => (
                  // 환승역은 다음 세그먼트 첫 역과 중복 — 세그먼트 첫 역은 두 번째 세그먼트부터 생략
                  (si === 0 || i > 0) && (
                    <span key={id} className="routestation">
                      {i > 0 && <span className="dash" aria-hidden="true" style={{ color: lineColor }}>–</span>}
                      {id === firstId ? (
                        <span className="routedot dep" aria-hidden="true" />
                      ) : id === lastId ? (
                        <span className="routedot arr" aria-hidden="true" />
                      ) : transferIds.has(id) ? (
                        <span className="routedot transfer" aria-hidden="true" />
                      ) : null}
                      <button className={activeId === id ? "on" : ""} aria-current={activeId === id ? "true" : undefined} onClick={() => onStation(id)}>{STATIONS[id].name}</button>
                    </span>
                  )
                ))}
              </span>
            );
          })}
        </div>
        <button className="iconbtn" aria-label="Scroll right" onClick={() => scrollBy(160)}><Icon name="chev" size="xs" /></button>
        <button className="iconbtn" aria-label="Clear route" onClick={onClear}><Icon name="x" size="xs" /></button>
      </div>
    </div>
  );
}
