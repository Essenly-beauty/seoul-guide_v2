"use client";

import { useEffect, useMemo, useRef } from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  LINE_META,
  STATIONS,
  lineTextColor,
  routeSegmentStartIndices,
  stationDisplayName,
  travelMinutes,
  type SubwayRoute,
} from "@/lib/subway";

const scrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

export function RouteStrip({ route, activeIndex, embedded = false, onStation, onClear }: {
  route: SubwayRoute;
  activeIndex: number;
  embedded?: boolean;
  onStation: (index: number) => void;
  onClear: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeButton = useRef<HTMLButtonElement>(null);
  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: scrollBehavior() });

  useEffect(() => {
    const container = scroller.current;
    const button = activeButton.current;
    if (!container || !button) return;
    const containerBox = container.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    container.scrollTo({
      left: container.scrollLeft + buttonBox.left - containerBox.left - (containerBox.width - buttonBox.width) / 2,
      behavior: scrollBehavior(),
    });
  }, [activeIndex]);

  const transfers = route.segments.length - 1;
  const segmentStarts = useMemo(() => routeSegmentStartIndices(route), [route]);
  // A transfer boundary is an absolute route occurrence, not a station id:
  // a via route may legitimately revisit the same physical station.
  const transferIndices = useMemo(
    () => new Set(segmentStarts.slice(1)),
    [segmentStarts],
  );

  return (
    <div className={`routestrip${embedded ? " embedded" : ""}`} role="group" aria-label="Stations on this subway route">
      {!embedded && (
        <div className="routesummary">
          <b>~{travelMinutes(route)} min</b>
          <span aria-hidden="true">·</span>
          <span>{transfers === 0 ? "direct" : `${transfers} transfer${transfers > 1 ? "s" : ""}`}</span>
        </div>
      )}
      <div className="routestrip-controls">
        <IconButton name="back" label="Scroll left" iconSize="xs" onClick={() => scrollBy(-160)} />
        <div className="routescroll" ref={scroller}>
          {route.segments.map((seg, si) => {
            const lineColor = LINE_META[seg.line].color;
            return (
              <span
                key={`${seg.line}-${si}`}
                className="routeseg"
                style={{ "--route-line": lineColor } as React.CSSProperties}
              >
                <span
                  className="linebadge"
                  style={{ background: lineColor, color: lineTextColor(lineColor) }}
                  title={LINE_META[seg.line].label}
                >
                  {LINE_META[seg.line].shortLabel}
                </span>
                {seg.stations.map((id, i) => {
                  const absoluteIndex = segmentStarts[si] + i;
                  // A transfer closes one segment and opens the next, so the
                  // first station of later segments is already rendered.
                  return si === 0 || i > 0 ? (
                    <button
                      type="button"
                      key={`${id}-${absoluteIndex}`}
                      ref={activeIndex === absoluteIndex ? activeButton : undefined}
                      className={`routestation${activeIndex === absoluteIndex ? " on" : ""}`}
                      style={{
                        "--route-line": transferIndices.has(absoluteIndex) && route.segments[si + 1]
                          ? LINE_META[route.segments[si + 1].line].color
                          : lineColor,
                      } as React.CSSProperties}
                      aria-current={activeIndex === absoluteIndex ? "location" : undefined}
                      aria-label={`${STATIONS[id].name} Station${activeIndex === absoluteIndex ? ", selected" : ""}`}
                      onClick={() => onStation(absoluteIndex)}
                    >
                      <span
                        className={`routedot${absoluteIndex === 0 ? " dep" : absoluteIndex === route.stations.length - 1 ? " arr" : transferIndices.has(absoluteIndex) ? " transfer" : ""}`}
                        aria-hidden="true"
                      />
                      <span>{stationDisplayName(STATIONS[id])}</span>
                    </button>
                  ) : null;
                })}
              </span>
            );
          })}
        </div>
        <IconButton name="chev" label="Scroll right" iconSize="xs" onClick={() => scrollBy(160)} />
        {!embedded && <IconButton name="x" label="Clear route" iconSize="xs" onClick={onClear} />}
      </div>
    </div>
  );
}
