/** Two-finger zoom + rotate for the map, the maths only.
 *
 *  Leaflet has no rotation; the app runs a Leaflet fork (leaflet-rotate-map)
 *  that can set a bearing but ships no gesture for it, and its built-in pinch
 *  handler is not rotation-aware (an off-centre pinch on a rotated map let the
 *  point under the fingers drift 92px in the prototype, 2026-09-27). So the
 *  DOM handler in lib/map-touch-rotate.ts owns the two-finger gesture and
 *  feeds this module screen points; this module answers with the zoom,
 *  bearing and pivot to apply. Nothing here touches Leaflet or the DOM, which
 *  is what lets lib/map-rotate.test.ts pin the feel of the gesture.
 *
 *  The conventions are MapLibre's (BSD), which is what Google-Maps-trained
 *  thumbs expect: rotation arms only once the fingers have travelled
 *  ROTATION_THRESHOLD_PX along their own circle, so a wide spread arms sooner
 *  than a narrow one; the angle accumulated before arming is discarded so the
 *  map never jumps when it arms; the smallest spread seen during the gesture
 *  sets the threshold so pinching in does not turn into a rotation; and a
 *  gesture that ends within BEARING_SNAP_DEG of north settles onto north. */

export type Pt = { x: number; y: number };

/** Pixels the fingers must travel along their circle before the map rotates. */
export const ROTATION_THRESHOLD_PX = 25;
/** A bearing this close to north at the end of a gesture snaps to north. */
export const BEARING_SNAP_DEG = 7;

const DEG = 180 / Math.PI;

/** Angle of the line from a to b, degrees, screen y down (so 90° points down). */
export function angleDeg(a: Pt, b: Pt): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * DEG;
}

/** Signed shortest turn from one angle to another, in (-180, 180]. */
export function shortestDelta(fromDeg: number, toDeg: number): number {
  return normalizeBearing(toDeg - fromDeg);
}

/** Fold any angle into (-180, 180]. */
export function normalizeBearing(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  // -180 and 180 are the same heading; report the positive one so a bearing
  // of "due south" compares equal however it was reached.
  return Object.is(wrapped, -180) || wrapped === -180 ? 180 : wrapped;
}

/** Degrees of twist that equal ROTATION_THRESHOLD_PX on a circle of this diameter. */
export function rotationThresholdDeg(minDiameterPx: number): number {
  const circumference = Math.PI * Math.max(minDiameterPx, 1);
  return (ROTATION_THRESHOLD_PX / circumference) * 360;
}

/** Rotate a screen vector by deg, clockwise on screen (y down). Matches the
 *  fork's Point.rotate and its container ← CRS mapping:
 *  container = centre + rotate(crs(p) − crs(centre), +bearing). */
export function rotatePoint(p: Pt, deg: number): Pt {
  const a = deg / DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** The CRS point to put at the container centre so that `anchorCrs` sits
 *  exactly under `midpoint` at this bearing. Solves the fork's forward model
 *  for the centre: crs(centre) = crs(anchor) − rotate(mid − c, −bearing). */
export function pivotCenter(anchorCrs: Pt, midpoint: Pt, containerCenter: Pt, bearingDeg: number): Pt {
  const offset = rotatePoint({ x: midpoint.x - containerCenter.x, y: midpoint.y - containerCenter.y }, -bearingDeg);
  return { x: anchorCrs.x - offset.x, y: anchorCrs.y - offset.y };
}

/** North if within the snap band, else the bearing untouched. */
export function snapToNorth(bearingDeg: number, snapDeg: number = BEARING_SNAP_DEG): number {
  return Math.abs(normalizeBearing(bearingDeg)) < snapDeg ? 0 : bearingDeg;
}

export type TwoFingerFrame = {
  zoom: number;
  bearing: number;
  midpoint: Pt;
  /** True once the twist has crossed the threshold; stays true for the gesture. */
  rotating: boolean;
  /** Finger spread relative to the start of the gesture. */
  scale: number;
};

export type TwoFingerGesture = { update(touches: [Pt, Pt]): TwoFingerFrame };

/** Start a two-finger gesture from the fingers' first positions and the
 *  map's current zoom and bearing. `scaleZoom` maps a spread ratio to a zoom
 *  the way the map's CRS does (Leaflet: map.getScaleZoom); the default is
 *  the plain Web-Mercator log2. */
export function createTwoFingerGesture(init: {
  touches: [Pt, Pt];
  zoom: number;
  bearing: number;
  scaleZoom?: (scale: number, fromZoom: number) => number;
}): TwoFingerGesture {
  const scaleZoom = init.scaleZoom ?? ((scale, from) => from + Math.log2(scale));
  const startDist = Math.max(dist(init.touches), 1);
  let minDiameter = startDist;
  let lastAngle = angleDeg(init.touches[0], init.touches[1]);
  let rotating = false;
  let turned = 0; // degrees accumulated since arming, unbounded so >180° twists work
  let sinceStart = 0; // degrees accumulated since the gesture began, for the threshold

  return {
    update(touches) {
      const d = Math.max(dist(touches), 1);
      minDiameter = Math.min(minDiameter, d);
      const angle = angleDeg(touches[0], touches[1]);
      const step = shortestDelta(lastAngle, angle);
      lastAngle = angle;
      if (rotating) {
        turned += step;
      } else {
        sinceStart += step;
        // Arm on this frame but do not apply its angle: the discarded
        // sub-threshold twist is what keeps arming from jumping the map.
        if (Math.abs(sinceStart) >= rotationThresholdDeg(minDiameter)) rotating = true;
      }
      const scale = d / startDist;
      return {
        zoom: scaleZoom(scale, init.zoom),
        bearing: normalizeBearing(init.bearing + turned),
        midpoint: { x: (touches[0].x + touches[1].x) / 2, y: (touches[0].y + touches[1].y) / 2 },
        rotating,
        scale,
      };
    },
  };
}

function dist([a, b]: [Pt, Pt]): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
