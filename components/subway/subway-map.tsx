"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { METRO_SVG } from "./metro-svg";
import { STATIONS, LINE_META, shopCount } from "@/lib/subway";
import { Icon } from "@/components/icon";
import type { Place } from "@/lib/data";

// The processed metro SVG has no explicit width/height (viewBox only); this
// wrapper CSS width/height (see .subwaywrap svg in globals.css) makes 1 SVG
// unit == 1 CSS px pre-transform, so initial-position math below is simple
// (no viewBox-to-pixel scaling factor to account for).
const SVG_W = 1150.36;
const SVG_H = 1074.59;

// One attribute read on the generated SVG string to find Gangnam's hit-circle
// coordinates for the initial viewport — not structural parsing, just a single
// regex match on a known, stable attribute (see task brief).
const GANGNAM_XY = (() => {
  const m = METRO_SVG.match(/data-station="gangnam" cx="([\d.]+)" cy="([\d.]+)"/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: SVG_W / 2, y: SVG_H / 2 };
})();

const INITIAL_SCALE = 2.2;
const MIN_SCALE = 0.8;
const MAX_SCALE = 5;

type ZoomTier = "far" | "mid" | "near";
function tierFor(scale: number): ZoomTier {
  if (scale < 1.2) return "far";
  if (scale < 2.2) return "mid";
  return "near";
}

type CalloutState = { stationId: string; x: number; y: number } | null;

function ZoomButtons() {
  const { zoomIn, zoomOut } = useControls();
  return (
    <div className="metro-zoombtn">
      <button aria-label="Zoom in" onClick={() => zoomIn()}>
        <Icon name="plus" size="xs" />
      </button>
      <button aria-label="Zoom out" onClick={() => zoomOut()}>
        <Icon name="minus" size="xs" />
      </button>
    </div>
  );
}

export function SubwayMap({
  places,
  departure,
  arrival,
  onSetDeparture,
  onSetArrival,
}: {
  places: Place[];
  departure: string | null;
  arrival: string | null;
  onSetDeparture: (id: string) => void;
  onSetArrival: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [callout, setCallout] = useState<CalloutState>(null);
  const [zoomTier, setZoomTier] = useState<ZoomTier>("near");
  const [initialPos, setInitialPos] = useState<{ x: number; y: number } | null>(null);

  // Center the initial viewport on Gangnam once the container is measured.
  // Falls back to a plain center-of-viewport guess if measurement is ever 0
  // (e.g. hidden ancestor during first paint).
  useEffect(() => {
    const el = wrapRef.current;
    const rect = el?.getBoundingClientRect();
    const w = rect?.width || 360;
    const h = rect?.height || 640;
    setInitialPos({
      x: w / 2 - GANGNAM_XY.x * INITIAL_SCALE,
      y: h / 2 - GANGNAM_XY.y * INITIAL_SCALE,
    });
  }, []);

  // Shop badges: injected directly into the dangerouslySetInnerHTML'd SVG DOM
  // (React doesn't own that subtree, so this is a deliberate escape hatch —
  // not a pattern to copy elsewhere). Re-runs whenever the filtered place
  // list changes so badge counts/visibility stay in sync, and also once
  // `initialPos` flips from null -> measured, since that's when the real
  // SVG tree (as opposed to the pre-measurement placeholder) first mounts
  // and svgHostRef first attaches to a live node.
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;

    // Clean up badges from the previous run before re-inserting.
    svg.querySelectorAll(".shopbadge").forEach((n) => n.remove());

    const ns = "http://www.w3.org/2000/svg";
    for (const station of Object.values(STATIONS)) {
      const count = shopCount(places, station.id);
      if (count <= 0) continue;
      const hit = svg.querySelector(`[data-station="${station.id}"]`);
      if (!hit) continue;
      const cx = hit.getAttribute("cx");
      const cy = hit.getAttribute("cy");
      if (cx === null || cy === null) continue;

      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "shopbadge");
      g.setAttribute("transform", `translate(${parseFloat(cx) + 7}, ${parseFloat(cy) - 7})`);

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", "7");
      g.appendChild(circle);

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", "1");
      text.textContent = count > 9 ? "9+" : String(count);
      g.appendChild(text);

      hit.parentElement?.appendChild(g);
    }
  }, [places, initialPos]);

  const closeCallout = useCallback(() => setCallout(null), []);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const hit = target.closest("[data-station]");
    if (!hit || !wrapRef.current) {
      closeCallout();
      return;
    }
    const stationId = hit.getAttribute("data-station");
    if (!stationId || !STATIONS[stationId]) {
      closeCallout();
      return;
    }
    const hitRect = hit.getBoundingClientRect();
    const wrapRect = wrapRef.current.getBoundingClientRect();
    setCallout({
      stationId,
      x: hitRect.left + hitRect.width / 2 - wrapRect.left,
      y: hitRect.top - wrapRect.top,
    });
  }, [closeCallout]);

  useEffect(() => {
    if (!callout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCallout();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [callout, closeCallout]);

  const station = callout ? STATIONS[callout.stationId] : null;

  const lineBadges = useMemo(() => {
    if (!station) return [];
    return station.lines.map((lineId) => ({ lineId, meta: LINE_META[lineId] })).filter((l) => l.meta);
  }, [station]);

  if (initialPos === null) {
    // Not yet measured — render the wrapper (for ref measurement) without the
    // transform tree so we don't mount at a wrong default position first.
    return <div className="subwaywrap" ref={wrapRef} role="application" aria-label="Seoul subway map" />;
  }

  return (
    <div
      className="subwaywrap"
      ref={wrapRef}
      role="application"
      aria-label="Seoul subway map"
      data-zoom={zoomTier}
      onClick={handleContainerClick}
    >
      <TransformWrapper
        initialScale={INITIAL_SCALE}
        initialPositionX={initialPos.x}
        initialPositionY={initialPos.y}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        centerOnInit={false}
        wheel={{ step: 0.2 }}
        pinch={{ step: 5 }}
        doubleClick={{ mode: "zoomIn", step: 0.7 }}
        onTransform={(_ref, state) => {
          setZoomTier(tierFor(state.scale));
          // Kakao-like: close the callout on pan/zoom rather than tracking its
          // position through the transform — simpler and matches the native
          // map-app feel of "moving the map dismisses the pin popup".
          setCallout((c) => (c ? null : c));
        }}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: SVG_W, height: SVG_H }}>
          <div
            ref={svgHostRef}
            style={{ width: SVG_W, height: SVG_H }}
            dangerouslySetInnerHTML={{ __html: METRO_SVG }}
          />
        </TransformComponent>
        <ZoomButtons />
      </TransformWrapper>

      {station && callout && (
        <div
          className="metro-callout"
          style={{ left: callout.x, top: callout.y }}
          role="dialog"
          aria-label={`${station.name} station`}
        >
          <button className="iconbtn metro-callout-close" aria-label="Close" onClick={closeCallout}>
            <Icon name="x" size="xs" />
          </button>
          <div className="metro-callout-title">{station.name}</div>
          <div className="metro-callout-kr small muted">{station.nameKr}</div>
          <div className="metro-callout-lines">
            {lineBadges.map(({ lineId, meta }) => (
              <span key={lineId} className="linebadge" style={{ background: meta.color }}>{meta.shortLabel}</span>
            ))}
          </div>
          <div className="metro-callout-actions">
            <button
              className="metro-callout-btn dep"
              onClick={() => { onSetDeparture(station.id); closeCallout(); }}
            >
              {departure === station.id ? "✓ " : ""}Departure
            </button>
            <button
              className="metro-callout-btn arr"
              onClick={() => { onSetArrival(station.id); closeCallout(); }}
            >
              {arrival === station.id ? "✓ " : ""}Arrival
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
