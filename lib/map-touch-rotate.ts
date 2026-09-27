import L from "leaflet";
import { BEARING_SNAP_DEG, createTwoFingerGesture, normalizeBearing, pivotCenter, snapToNorth, type Pt, type TwoFingerFrame, type TwoFingerGesture } from "./map-rotate";

/** Two-finger zoom + rotate for the Leaflet fork (leaflet-rotate-map).
 *
 *  Leaflet's own TouchZoom is not rotation-aware — on a rotated map an
 *  off-centre pinch let the point under the fingers drift 92px — and the fork
 *  ships no rotate gesture at all. This handler replaces TouchZoom: it owns
 *  the two-finger gesture, asks lib/map-rotate.ts what zoom, bearing and
 *  pivot the fingers mean, and applies them once per animation frame with the
 *  same map internals Leaflet's pinch uses (_moveStart, _move, _animateZoom),
 *  so every listener that worked for a pinch keeps working. It ends the way
 *  Leaflet ends a pinch (zoom snaps to zoomSnap), plus one thing Leaflet
 *  never had: a bearing within BEARING_SNAP_DEG of north eases back to north.
 */

type MapInternals = L.Map & {
  _animatingZoom?: boolean;
  _limitZoom(zoom: number): number;
  _moveStart(zoomChanged: boolean, noMoveStart: boolean): L.Map;
  _move(center: L.LatLng, zoom: number, data?: unknown, supressEvent?: boolean): L.Map;
  _stop(): L.Map;
  _animateZoom(center: L.LatLng, zoom: number, startAnim: boolean, noUpdate?: boolean | number): void;
  _resetView(center: L.LatLng, zoom: number, noMoveStart?: boolean): void;
};

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The fork stores `(theta || 0.1)`: a bearing of exactly 0 becomes 0.1°, and
 *  every tile and label is then resampled through a rotate transform on a map
 *  nobody turned (visibly softer text). This epsilon keeps the fork's truthy
 *  `_bearing` checks satisfied and the raster pixel-aligned: one part in a
 *  billion of a degree is below any float the compositor can distinguish
 *  from identity. */
export const NORTH_EPS = 1e-9;
const forkBearing = (deg: number) => (deg === 0 ? NORTH_EPS : deg);

/** The map's bearing in degrees, with the fork's quirks folded away. */
export function bearingOf(map: L.Map): number {
  const deg = typeof map.getBearing === "function" ? map.getBearing() : 0;
  return Math.abs(deg) < 0.2 ? 0 : normalizeBearing(deg);
}

/** What is on screen. getBounds() is the unrotated box; on a rotated map the
 *  corners of the screen poke outside it, so culling by it drops real pins. */
export function visibleBounds(map: L.Map): L.LatLngBounds {
  return typeof map.getCircumscribedBounds === "function" ? map.getCircumscribedBounds() : map.getBounds();
}

/** The fork's setBearing fires "moveend" on every call, which for the app
 *  means a full re-cull and re-render per frame of the gesture. Leaflet's own
 *  pinch fires moveend once, at the end; keep to that. "rotate" still fires,
 *  which is what markers use to stay upright. */
function setBearingQuietly(map: L.Map, bearingDeg: number) {
  const fire = map.fire;
  map.fire = function (this: L.Map, type: string, data?: unknown, propagate?: boolean) {
    return type === "moveend" ? this : fire.call(this, type, data, propagate);
  } as typeof map.fire;
  try {
    map.setBearing(forkBearing(bearingDeg));
  } finally {
    map.fire = fire;
  }
}

/** Put a freshly created map on true north. The fork initialises to its 0.1°
 *  stand-in; nothing else has moved, so this needs no moveend. */
export function settleNorth(map: L.Map): void {
  if (typeof map.setBearing === "function") setBearingQuietly(map, 0);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** One bearing animation per map. */
const animations = new WeakMap<L.Map, number>();

/** Stop a running bearing ease. Its frames were quiet, so the moveend they
 *  withheld — what loads tiles and re-culls — fires here unless the caller
 *  is tearing the map down. */
export function stopBearingAnimation(map: L.Map, flush = true): void {
  const id = animations.get(map);
  if (id === undefined) return;
  L.Util.cancelAnimFrame(id);
  animations.delete(map);
  if (flush) map.fire("moveend");
}

/** Ease the bearing to `to` over `ms` (instant under reduced motion), then
 *  fire the one moveend the frames withheld. */
export function animateBearing(map: L.Map, to: number, ms = 300): void {
  stopBearingAnimation(map, false);
  const from = bearingOf(map);
  const delta = normalizeBearing(to - from);
  const finish = () => {
    animations.delete(map);
    map.setBearing(forkBearing(to));
  };
  if (ms <= 0 || reducedMotion() || Math.abs(delta) < 0.05) {
    finish();
    return;
  }
  const started = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - started) / ms);
    if (t >= 1) {
      finish();
      return;
    }
    setBearingQuietly(map, from + delta * easeOutCubic(t));
    animations.set(map, L.Util.requestAnimFrame(step));
  };
  animations.set(map, L.Util.requestAnimFrame(step));
}

/** Compass tap: back to north about the centre. */
export function resetNorth(map: L.Map): void {
  animateBearing(map, 0, 300);
}

export class TouchZoomRotate extends L.Handler {
  private readonly map: MapInternals;
  private gesture: TwoFingerGesture | null = null;
  private anchor: L.LatLng | null = null;
  private moved = false;
  private frame: number | null = null;
  private pending: TwoFingerFrame | null = null;
  private last: TwoFingerFrame | null = null;
  private center: L.LatLng | null = null;
  private snap: (() => void) | null = null;

  constructor(map: L.Map) {
    super(map);
    this.map = map as MapInternals;
  }

  addHooks(): void {
    const container = this.map.getContainer();
    // Leaflet's stylesheet gives the container touch-action:none only when
    // this class is present; without it the browser pinch-zooms the page.
    L.DomUtil.addClass(container, "leaflet-touch-zoom");
    L.DomEvent.on(container, "touchstart", this.onStart as L.DomEvent.EventHandlerFn, this);
  }

  removeHooks(): void {
    const container = this.map.getContainer();
    L.DomUtil.removeClass(container, "leaflet-touch-zoom");
    L.DomEvent.off(container, "touchstart", this.onStart as L.DomEvent.EventHandlerFn, this);
    this.detachDocument();
    this.disarmSnap();
    // Nothing may run after this: a queued frame would call into a map that
    // React is about to remove.
    if (this.frame !== null) {
      L.Util.cancelAnimFrame(this.frame);
      this.frame = null;
    }
    stopBearingAnimation(this.map, false);
    this.gesture = null;
    this.pending = null;
    this.last = null;
  }

  /** True between the second finger landing and the gesture settling. */
  active(): boolean {
    return this.gesture !== null;
  }

  private points(e: TouchEvent): [Pt, Pt] {
    const a = this.map.mouseEventToContainerPoint(e.touches[0] as unknown as MouseEvent);
    const b = this.map.mouseEventToContainerPoint(e.touches[1] as unknown as MouseEvent);
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  }

  private onStart(e: TouchEvent) {
    const map = this.map;
    if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this.gesture) return;
    // Fingers landing mid-ease take over from it; the ease's withheld moveend
    // fires so tiles and the app catch up even if this gesture never moves.
    stopBearingAnimation(map);
    this.disarmSnap();
    const touches = this.points(e);
    const mid = L.point((touches[0].x + touches[1].x) / 2, (touches[0].y + touches[1].y) / 2);
    this.anchor = map.containerPointToLatLng(mid);
    this.gesture = createTwoFingerGesture({
      touches,
      zoom: map.getZoom(),
      bearing: bearingOf(map),
      scaleZoom: (scale, from) => map.getScaleZoom(scale, from),
    });
    this.moved = false;
    this.pending = null;
    this.last = null;
    map._stop();
    const doc = document as unknown as HTMLElement;
    L.DomEvent.on(doc, "touchmove", this.onMove as L.DomEvent.EventHandlerFn, this);
    L.DomEvent.on(doc, "touchend touchcancel", this.onEnd as L.DomEvent.EventHandlerFn, this);
    L.DomEvent.preventDefault(e);
  }

  private onMove(e: TouchEvent) {
    const map = this.map;
    if (!this.gesture || !e.touches || e.touches.length !== 2) return;
    const frame = this.gesture.update(this.points(e));
    // Same clamp as Leaflet's pinch: no bounce past the zoom limits.
    if (!map.options.bounceAtZoomLimits && (
      (frame.zoom < map.getMinZoom() && frame.scale < 1) ||
      (frame.zoom > map.getMaxZoom() && frame.scale > 1))) {
      frame.zoom = map._limitZoom(frame.zoom);
    }
    if (!this.moved) {
      map._moveStart(true, false);
      this.moved = true;
    }
    this.pending = frame;
    if (this.frame === null) this.frame = L.Util.requestAnimFrame(this.apply, this);
    L.DomEvent.preventDefault(e);
  }

  /** One map update per animation frame, whatever the touch event rate. */
  private apply() {
    this.frame = null;
    const frame = this.pending;
    const map = this.map;
    if (!frame || !this.anchor) return;
    this.pending = null;
    if (frame.rotating && (!this.last || this.last.bearing !== frame.bearing)) {
      setBearingQuietly(map, frame.bearing);
    }
    // Keep the geography that was under the fingers under the fingers: the
    // centre is solved from the anchor, the midpoint and the bearing.
    const anchorCrs = map.project(this.anchor, frame.zoom);
    const half = map.getSize().divideBy(2);
    const bearing = frame.rotating ? frame.bearing : bearingOf(map);
    const centreCrs = pivotCenter({ x: anchorCrs.x, y: anchorCrs.y }, frame.midpoint, { x: half.x, y: half.y }, bearing);
    this.center = map.unproject(L.point(centreCrs.x, centreCrs.y), frame.zoom);
    map._move(this.center, frame.zoom, { pinch: true, round: false });
    this.last = frame;
  }

  private onEnd(e: TouchEvent) {
    if (!this.gesture || (e.touches && e.touches.length >= 2)) return;
    const map = this.map;
    this.detachDocument();
    this.gesture = null;
    // A quick pinch can end before its frame ran: apply it now, so the
    // gesture still finishes below (zoom snap, moveend) instead of leaving
    // the map at a fractional zoom with a frame queued to run after the end.
    if (this.frame !== null) {
      L.Util.cancelAnimFrame(this.frame);
      this.frame = null;
    }
    if (this.pending) this.apply();
    const last = this.last;
    if (!this.moved || !last || !this.center) return;
    const center = this.center;
    // A bearing that ended near north eases home once the zoom has settled.
    // The listener goes on *before* the finish call: Leaflet's zoom proxy
    // ends the animation synchronously inside _animateZoom when the transform
    // did not change (Leaflet #4149), which is exactly what a rotation about
    // the centre produces, and moveend has then already fired by the time
    // the call returns.
    const snapped = snapToNorth(last.bearing, BEARING_SNAP_DEG);
    if (last.rotating && snapped !== last.bearing) this.armSnap(map);
    // Finish exactly as Leaflet finishes a pinch: zoom snaps, moveend fires.
    if (map.options.zoomAnimation) map._animateZoom(center, map._limitZoom(last.zoom), true, map.options.zoomSnap);
    else map._resetView(center, map._limitZoom(last.zoom));
  }

  /** One pending north snap at a time; a new gesture cancels it, so a stale
   *  listener can never turn a later, deliberate rotation back north. */
  private armSnap(map: L.Map) {
    this.disarmSnap();
    const fn = () => {
      this.snap = null;
      if (!this.gesture) animateBearing(map, 0, 200);
    };
    this.snap = fn;
    map.once("moveend", fn);
  }

  private disarmSnap() {
    if (!this.snap) return;
    this.map.off("moveend", this.snap);
    this.snap = null;
  }

  private detachDocument() {
    const doc = document as unknown as HTMLElement;
    L.DomEvent.off(doc, "touchmove", this.onMove as L.DomEvent.EventHandlerFn, this);
    L.DomEvent.off(doc, "touchend touchcancel", this.onEnd as L.DomEvent.EventHandlerFn, this);
  }
}
