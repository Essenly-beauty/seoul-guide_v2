export type MapSheetSnap = "peek" | "half" | "full";

export type SelectedPlaceView = "compact" | "summary" | "detail";

export function resolveSelectedPlaceView(snap: MapSheetSnap): SelectedPlaceView {
  if (snap === "peek") return "compact";
  if (snap === "half") return "summary";
  return "detail";
}

export function nextMapSheetSnap(snap: MapSheetSnap): MapSheetSnap {
  if (snap === "half") return "full";
  if (snap === "full") return "peek";
  return "half";
}

export function getMapSheetHalfOffsetRatio(hasSelection: boolean): number {
  return hasSelection ? 0.52 : 0.42;
}

// ── Drag physics ─────────────────────────────────────────────────────────
// Pure so the release rules can be unit-tested without a DOM. Positions are
// the sheet's translateY in px: 0 = full, larger = further down the screen.

export type MapSheetOffsets = Record<MapSheetSnap, number>;

/** A release moving at least this fast (px per ms) is a flick: it always
    advances to a snap in the direction of travel, never settles back. */
export const FLICK_VELOCITY = 0.45;
/** Momentum window: how far the sheet would drift on if nothing stopped it. */
export const MOMENTUM_MS = 200;
/** A snap this close to the finger counts as "already here" for a flick. */
const HERE_TOLERANCE_PX = 12;

/** Which snap the sheet should settle into when the finger lifts. Velocity
    projects the finger's momentum forward; a flick is only allowed to land
    ahead of the finger, so a quick push from half never bounces back to half. */
export function resolveReleaseSnap({
  offsets,
  position,
  velocity,
}: {
  offsets: MapSheetOffsets;
  position: number;
  velocity: number;
}): MapSheetSnap {
  const ordered = (Object.keys(offsets) as MapSheetSnap[]).sort((a, b) => offsets[a] - offsets[b]);
  const projected = position + velocity * MOMENTUM_MS;
  let candidates = ordered;
  if (Math.abs(velocity) >= FLICK_VELOCITY) {
    const ahead = ordered.filter((snap) =>
      velocity > 0 ? offsets[snap] > position + HERE_TOLERANCE_PX : offsets[snap] < position - HERE_TOLERANCE_PX,
    );
    candidates = ahead.length > 0 ? ahead : [velocity > 0 ? ordered[ordered.length - 1] : ordered[0]];
  }
  return candidates.reduce((best, snap) =>
    Math.abs(offsets[snap] - projected) < Math.abs(offsets[best] - projected) ? snap : best,
  );
}

/** iOS-style resistance past the first and last snap: the further the finger
    overshoots, the less the sheet follows, and it can never travel more than
    `dimension` beyond the bound. */
export function rubberBand(value: number, min: number, max: number, dimension: number, coefficient = 0.55): number {
  if (value >= min && value <= max) return value;
  const bound = value < min ? min : max;
  const over = Math.abs(value - bound);
  const eased = (1 - 1 / ((over * coefficient) / Math.max(1, dimension) + 1)) * dimension;
  return value < min ? bound - eased : bound + eased;
}

/** Positions for the settle animation: a damped spring that starts with the
    finger's release velocity, sampled per frame so it can be handed to
    element.animate() with a linear easing. Ends exactly on `to`. */
export function springKeyframes({
  from,
  to,
  velocity,
  stiffness = 260,
  damping = 30,
  mass = 1,
  frameMs = 1000 / 60,
  maxMs = 700,
}: {
  from: number;
  to: number;
  /** px per ms, same sign convention as the positions. */
  velocity: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  frameMs?: number;
  maxMs?: number;
}): { frames: number[]; duration: number } {
  const frames = [from];
  let x = from - to;
  let v = velocity * 1000; // px per second
  const substeps = 4;
  const dt = frameMs / 1000 / substeps;
  let elapsed = 0;
  while (elapsed < maxMs) {
    for (let i = 0; i < substeps; i++) {
      const acceleration = (-stiffness * x - damping * v) / mass;
      v += acceleration * dt;
      x += v * dt;
    }
    elapsed += frameMs;
    frames.push(to + x);
    if (Math.abs(x) < 0.3 && Math.abs(v) < 20) break;
  }
  frames[frames.length - 1] = to;
  return { frames, duration: (frames.length - 1) * frameMs };
}

/** Did this gesture move the sheet enough that the click it produces should be
 *  swallowed?
 *
 *  Decided at RELEASE, not when the drag is confirmed. Confirming after a few
 *  pixels and marking the gesture "moved" there meant a hand shaken while
 *  walking ate the tap although the sheet had gone nowhere. Position is the
 *  wrong measure too: rubber-banding damps travel near a limit by 0.55, so a
 *  short fast flick that does change the snap reads as almost no movement.
 *  Finger travel plus "did the snap change" covers both. */
export function didDrag({
  travel,
  target,
  snap,
  slop,
}: {
  /** Largest vertical distance the finger reached from where it went down. */
  travel: number;
  target: MapSheetSnap;
  snap: MapSheetSnap;
  slop: number;
}): boolean {
  if (target !== snap) return true;
  return travel > slop + 6;
}
