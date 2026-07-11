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
// W2: Wikimedia base map, viewBox 0 0 5724 6516 (portrait; was the Sinseiki
// base's ~1150.36x1074.59 landscape crop — ~5x larger in linear units).
const SVG_W = 5724;
const SVG_H = 6516;

// One attribute read on the generated SVG string to find Gangnam's hit-circle
// coordinates for the initial viewport — not structural parsing, just a single
// regex match on a known, stable attribute (see task brief). Unchanged for
// W2: the synthesized hit-circle markup format (data-station, then cx, then
// cy) is the same in the new SVG, just with new coordinate values (~3599.83,
// 3060.28 in the new viewBox).
const GANGNAM_XY = (() => {
  const m = METRO_SVG.match(/data-station="gangnam" cx="([\d.]+)" cy="([\d.]+)"/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: SVG_W / 2, y: SVG_H / 2 };
})();

// W2 retune for the ~5x-larger viewBox: old INITIAL_SCALE (2.2) on the
// 1150-wide old viewBox showed ~14.8% of its width on a 375px screen. The new
// viewBox is 5724 wide, so the equivalent-density scale is 375 / (5724 *
// 0.148) ≈ 0.44 — tuned by eye to 0.45 so the Gangnam cluster (Gangnam,
// Yeoksam, Seolleung, Sinnonhyeon, Sinsa — inter-station spacing here runs
// ~70-150 viewBox units) reads as "a handful of stations across the screen",
// matching the old base's initial framing.
const INITIAL_SCALE = 0.45;
// MIN_SCALE: the whole portrait network (5724x6516) should fit a mobile
// viewport (~360x640, the same fallback used below for initial centering)
// without cropping — 360/5724 ≈ 0.063 is the binding (width) constraint, so
// 0.06 fits the full network with a small margin on all sides.
const MIN_SCALE = 0.06;
// MAX_SCALE: native label font-size in this viewBox is ~19-23px (see
// build-subway-svg.mjs), already large relative to the old base's ~2.4-5.5px
// labels, so a much smaller ceiling than the old 5 is enough for comfortably
// readable labels even in dense transfer-station clusters.
const MAX_SCALE = 1.2;

type ZoomTier = "far" | "mid" | "near";
function tierFor(scale: number): ZoomTier {
  // Boundaries recomputed to preserve the same ratio to INITIAL_SCALE (0.45)
  // as the old tiers had to the old INITIAL_SCALE (2.2): far/initial ≈ 0.545,
  // mid/initial ≈ 1.18. That keeps the initial paint landing on "mid" (tidy
  // label density) exactly as before, just at the new scale.
  if (scale < 0.25) return "far";
  if (scale < 0.55) return "mid";
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
  // react-zoom-pan-pinch does not invoke the `onTransform` prop on initial
  // mount (only on actual pan/zoom interactions), so the initial tier must be
  // computed the same way tierFor() would from INITIAL_SCALE (0.45 → "mid"),
  // or first paint would default to the wrong density until the user's first
  // pan/zoom interaction fires onTransform.
  const [zoomTier, setZoomTier] = useState<ZoomTier>(() => tierFor(INITIAL_SCALE));
  const [initialPos, setInitialPos] = useState<{ x: number; y: number } | null>(null);
  // Bumped only by the self-heal guard below when it detects the injected SVG
  // content (badges/pins) is actually missing — included in the injection
  // effects' deps so a detected wipe forces exactly one re-injection.
  const [healTick, setHealTick] = useState(0);

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

  // Cheap worklist for the badge effect below: computed once per `places`
  // change instead of walking all 592 STATIONS × haversine on every re-run.
  const badgeStations = useMemo(
    () =>
      Object.keys(STATIONS)
        .map((id) => [id, shopCount(places, id)] as const)
        .filter(([, n]) => n > 0),
    [places],
  );

  // Shop badges: injected directly into the dangerouslySetInnerHTML'd SVG DOM
  // (React doesn't own that subtree, so this is a deliberate escape hatch —
  // not a pattern to copy elsewhere). React only resets `__html` when the
  // string identity changes (METRO_SVG is a stable module constant) or the
  // host node remounts, and TransformComponent passes children through
  // without remounting them, so this only needs to run when the inputs that
  // actually affect the injected content change. The removal pass keeps it
  // idempotent on legitimate re-runs (e.g. `places` changing which stations
  // have shops).
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;

    // Clean up badges from the previous run before re-inserting.
    svg.querySelectorAll(".shopbadge").forEach((n) => n.remove());

    const ns = "http://www.w3.org/2000/svg";

    // W2: badge geometry scaled ~5x for the new viewBox (was r=5, offset ±5,
    // text y=1 — tuned against the old ~1150-wide viewBox where station
    // dots/hit-circles were correspondingly ~5x smaller than this map's).
    //
    // Quadrant pick: this Wikimedia map's labels sit all over the compass
    // relative to their marker — most still-diagonal (non-horizontalized)
    // labels run down-right from an anchor just up-right of the marker (e.g.
    // Gangnam's own label anchor is only ~23,-12 from its marker, so a fixed
    // up-right badge landed squarely on top of "Gangnam"), but horizontalized
    // labels like Seongsu sit centered directly *below* their marker. No
    // single fixed corner clears both, so we compare the on-screen rects of
    // the hit-circle and its own station label (same pan/zoom transform
    // applies to both, so the relative direction is preserved at any zoom)
    // and place the badge in the opposite quadrant. Falls back to down-left
    // if no label element is found. NOTE: this only dodges each station's OWN
    // label — badges render only for the small set of stations near the
    // user's filtered shops (≈Gangnam beauty zone), so cross-station badge/
    // label overlap isn't a practical concern at this data scale; accepted.
    //
    // Two passes to avoid layout thrashing: batch all getBoundingClientRect
    // reads first, then all DOM writes. Interleaving read→write→read would
    // force a synchronous reflow on every iteration's rect read.
    type BadgePlan = { parent: Element; cx: number; cy: number; signX: number; signY: number; count: number };
    const plans: BadgePlan[] = [];
    for (const [stationId, count] of badgeStations) {
      const hit = svg.querySelector(`[data-station="${stationId}"]`);
      if (!hit) continue;
      const parent = hit.parentElement;
      const cx = hit.getAttribute("cx");
      const cy = hit.getAttribute("cy");
      if (!parent || cx === null || cy === null) continue;

      let signX = -1;
      let signY = 1;
      const label = svg.querySelector(`[data-label-for="${stationId}"]`);
      if (label) {
        const hitRect = hit.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const dx = labelRect.x + labelRect.width / 2 - (hitRect.x + hitRect.width / 2);
        const dy = labelRect.y + labelRect.height / 2 - (hitRect.y + hitRect.height / 2);
        signX = dx >= 0 ? -1 : 1;
        signY = dy >= 0 ? -1 : 1;
      }
      plans.push({ parent, cx: parseFloat(cx), cy: parseFloat(cy), signX, signY, count });
    }

    for (const p of plans) {
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "shopbadge");
      g.setAttribute("transform", `translate(${p.cx + p.signX * 25}, ${p.cy + p.signY * 25})`);

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", "25");
      g.appendChild(circle);

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", "5");
      text.textContent = p.count > 9 ? "9+" : String(p.count);
      g.appendChild(text);

      p.parent.appendChild(g);
    }
  }, [badgeStations, initialPos, healTick]);

  // Departure/arrival pins — same SVG-injection escape hatch as the shop
  // badges above, so the pin pans/zooms with the map instead of drifting
  // like an absolutely-positioned div would. A small teardrop marker is
  // anchored with its tip on the station's hit-circle coordinates; the
  // departure pin additionally gets a ✕ clear-button (data-pin-clear="dep",
  // handled in handleContainerClick below) — the arrival pin is rendered
  // defensively only, since in practice setting arrival immediately flips
  // the parent into route mode and unmounts this component. See the
  // shop-badges effect above for why a real dependency array is correct here.
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
      // ~75 units above it. W2: geometry scaled ~5x from the old base's
      // tuning (bulb r=7, dot r=2.7 there) to sit proportionately next to
      // this map's station dots/transfer rings (~13-27 units) instead of
      // reading as tiny — see task brief for the ~5x viewBox factor.
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M0 0 C-23.5 -31 -35 -50 -35 -75 A35 35 0 0 1 35 -75 C35 -50 23.5 -31 0 0 Z");
      path.setAttribute("fill", color);
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "6");
      g.appendChild(path);

      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", "0");
      dot.setAttribute("cy", "-75");
      dot.setAttribute("r", "13.5");
      dot.setAttribute("fill", "#fff");
      g.appendChild(dot);

      if (clearable) {
        const clear = document.createElementNS(ns, "g");
        clear.setAttribute("class", "subway-pin-clear");
        clear.setAttribute("data-pin-clear", "dep");
        clear.setAttribute("transform", "translate(32.5, -110)");
        const cbg = document.createElementNS(ns, "circle");
        cbg.setAttribute("r", "27.5");
        cbg.setAttribute("fill", "#fff");
        cbg.setAttribute("stroke", color);
        cbg.setAttribute("stroke-width", "5.5");
        clear.appendChild(cbg);
        const cross = document.createElementNS(ns, "path");
        cross.setAttribute("d", "M-11 -11 L11 11 M11 -11 L-11 11");
        cross.setAttribute("stroke", color);
        cross.setAttribute("stroke-width", "7");
        cross.setAttribute("stroke-linecap", "round");
        clear.appendChild(cross);
        g.appendChild(clear);
      }

      hit.parentElement?.appendChild(g);
    };

    addPin(svg, departure, "dep-pin", "#1E6EF4", Boolean(onClearDeparture));
    addPin(svg, arrival, "arr-pin", "#E5462E", false);
  }, [departure, arrival, onClearDeparture, initialPos, healTick]);

  // Self-heal guard: an earlier version of the two effects above ran on every
  // render because opening the station toolbar was *suspected* to wipe this
  // div's dangerouslySetInnerHTML SVG back to pristine METRO_SVG. On
  // investigation, React only resets `__html` on identity change or remount —
  // neither happens here — so that was almost certainly a dev-only Fast
  // Refresh artifact, not a real production hazard. This effect keeps the
  // safety net without the O(592-station) cost: it runs on every render but
  // only does an O(1) `querySelector` presence check, and only forces a
  // re-injection (via healTick) when it actually finds injected content
  // missing — so it cannot loop (a successful re-injection makes the next
  // check pass and stop bumping).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately no deps array; must run every render to catch the hypothetical wipe.
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;
    const badgesMissing = badgeStations.length > 0 && !svg.querySelector(".shopbadge");
    const pinsMissing = Boolean(departure || arrival) && !svg.querySelector(".subway-pin");
    if (badgesMissing || pinsMissing) setHealTick((t) => t + 1);
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
