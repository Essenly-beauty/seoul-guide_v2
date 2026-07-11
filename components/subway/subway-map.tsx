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
  onClearDeparture,
}: {
  places: Place[];
  departure: string | null;
  arrival: string | null;
  onSetDeparture: (id: string) => void;
  onSetArrival: (id: string) => void;
  /** Clears the departure pin's own ✕ (subway mode only — once both departure
   *  and arrival are set the parent switches to route mode and unmounts this
   *  component before this would ever matter for arrival). */
  onClearDeparture?: () => void;
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
  // not a pattern to copy elsewhere). No dependency array — this deliberately
  // re-runs after every SubwayMap render, not just when `places`/`initialPos`
  // change: react-zoom-pan-pinch's TransformWrapper re-renders its children on
  // essentially any state change in this component (confirmed empirically —
  // e.g. simply opening the station toolbar), which silently resets this
  // div's innerHTML back to pristine METRO_SVG and wipes anything injected
  // here. Re-asserting on every render is the robust fix; the removal pass
  // below keeps it idempotent when the reset didn't actually happen.
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
      g.setAttribute("transform", `translate(${parseFloat(cx) + 5}, ${parseFloat(cy) - 5})`);

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", "5");
      g.appendChild(circle);

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", "1");
      text.textContent = count > 9 ? "9+" : String(count);
      g.appendChild(text);

      hit.parentElement?.appendChild(g);
    }
    // Intentionally no dependency array — see comment above.
  });

  // Departure/arrival pins — same SVG-injection escape hatch as the shop
  // badges above, so the pin pans/zooms with the map instead of drifting
  // like an absolutely-positioned div would. A small teardrop marker is
  // anchored with its tip on the station's hit-circle coordinates; the
  // departure pin additionally gets a ✕ clear-button (data-pin-clear="dep",
  // handled in handleContainerClick below) — the arrival pin is rendered
  // defensively only, since in practice setting arrival immediately flips
  // the parent into route mode and unmounts this component. No dependency
  // array — see the shop-badges effect above for why.
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;

    svg.querySelectorAll(".subway-pin").forEach((n) => n.remove());

    const ns = "http://www.w3.org/2000/svg";
    const addPin = (svgEl: Element, stationId: string | null, cls: string, color: string, clearable: boolean) => {
      if (!stationId) return;
      const hit = svgEl.querySelector(`[data-station="${stationId}"]`);
      if (!hit) return;
      const cx = hit.getAttribute("cx");
      const cy = hit.getAttribute("cy");
      if (cx === null || cy === null) return;

      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", `subway-pin ${cls}`);
      g.setAttribute("transform", `translate(${cx}, ${cy})`);

      // Teardrop: tip at the local origin (sits on the station), bulb centered
      // ~19 units above it — roughly on par with the r=9 station hit-circle.
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M0 0 C-6 -8 -9 -13 -9 -19 A9 9 0 0 1 9 -19 C9 -13 6 -8 0 0 Z");
      path.setAttribute("fill", color);
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "1.4");
      g.appendChild(path);

      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", "0");
      dot.setAttribute("cy", "-19");
      dot.setAttribute("r", "3.4");
      dot.setAttribute("fill", "#fff");
      g.appendChild(dot);

      if (clearable) {
        const clear = document.createElementNS(ns, "g");
        clear.setAttribute("class", "subway-pin-clear");
        clear.setAttribute("data-pin-clear", "dep");
        clear.setAttribute("transform", "translate(8, -28)");
        const cbg = document.createElementNS(ns, "circle");
        cbg.setAttribute("r", "6.5");
        cbg.setAttribute("fill", "#fff");
        cbg.setAttribute("stroke", color);
        cbg.setAttribute("stroke-width", "1.2");
        clear.appendChild(cbg);
        const cross = document.createElementNS(ns, "path");
        cross.setAttribute("d", "M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6");
        cross.setAttribute("stroke", color);
        cross.setAttribute("stroke-width", "1.6");
        cross.setAttribute("stroke-linecap", "round");
        clear.appendChild(cross);
        g.appendChild(clear);
      }

      hit.parentElement?.appendChild(g);
    };

    addPin(svg, departure, "dep-pin", "#1E6EF4", Boolean(onClearDeparture));
    addPin(svg, arrival, "arr-pin", "#E5462E", false);
  });

  const closeCallout = useCallback(() => setCallout(null), []);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const clearHit = target.closest("[data-pin-clear]");
    if (clearHit) {
      if (clearHit.getAttribute("data-pin-clear") === "dep") onClearDeparture?.();
      return;
    }
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
  }, [closeCallout, onClearDeparture]);

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
          className="metro-toolbar"
          style={{ left: callout.x, top: callout.y }}
          role="dialog"
          aria-label={`${station.name} station`}
        >
          <button className="iconbtn metro-toolbar-close" aria-label="Close" onClick={closeCallout}>
            <Icon name="x" size="xs" />
          </button>
          <div className="metro-toolbar-name">
            <span className="metro-toolbar-en">{station.name}</span>
            <span className="metro-toolbar-kr">{station.nameKr}</span>
            {lineBadges.length > 0 && (
              <div className="metro-toolbar-lines">
                {lineBadges.map(({ lineId, meta }) => (
                  <span key={lineId} className="linebadge" style={{ background: meta.color }}>{meta.shortLabel}</span>
                ))}
              </div>
            )}
          </div>
          <div className="metro-toolbar-actions">
            <button
              className={"metro-toolbar-seg" + (departure === station.id ? " on" : "")}
              onClick={() => { onSetDeparture(station.id); closeCallout(); }}
            >
              <Icon name="ext" size="xs" />
              <span>{departure === station.id ? "✓ Departure" : "Departure"}</span>
            </button>
            <button
              className={"metro-toolbar-seg" + (arrival === station.id ? " on" : "")}
              onClick={() => { onSetArrival(station.id); closeCallout(); }}
            >
              <Icon name="ext" size="xs" style={{ transform: "rotate(180deg)" }} />
              <span>{arrival === station.id ? "✓ Arrival" : "Arrival"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
