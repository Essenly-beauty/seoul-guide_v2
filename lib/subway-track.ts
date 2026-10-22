/** Geometry shared by the route ticket's station track. Dots sit at even
    fractions of the rail, so the layout never grows past the sheet however
    long the trip, and pointer scrubbing (a rounded ratio of the rail width)
    lands on the dot that is drawn there. */
export type TrackDensity = "0" | "1" | "2";

/** Dot density from the measured spacing, so a 48-stop trip on a 320px phone
    still shows every end and transfer (codex review 2026-10-20). Without a
    measurement yet (server render, first paint) the stop count is the guess. */
export function routeTrackDensity(stopCount: number, railWidth: number): TrackDensity {
  if (stopCount <= 1) return "0";
  if (!(railWidth > 0)) return stopCount > 48 ? "2" : stopCount > 22 ? "1" : "0";
  const spacing = railWidth / (stopCount - 1);
  return spacing < 7 ? "2" : spacing < 12 ? "1" : "0";
}

/** Horizontal position of stop `index` along the rail as a CSS percentage;
    `stopOffset(1, count)` is also the width of one leg. */
export function stopOffset(index: number, stopCount: number): string {
  const last = Math.max(1, stopCount - 1);
  return `${(index / last) * 100}%`;
}

/** The stop a pointer at `clientX` lands on: stops sit at even fractions of
    the rail (the element the dots are laid along — not the wider track). */
export function stopIndexAt(clientX: number, rail: { left: number; width: number }, stopCount: number): number | null {
  const last = stopCount - 1;
  if (!(rail.width > 0) || last <= 0) return null;
  const ratio = Math.min(1, Math.max(0, (clientX - rail.left) / rail.width));
  return Math.round(ratio * last);
}

/** Slider keys (WAI-ARIA APG): Right/Up +1, Left/Down -1, Home/End to the
    ends, PageUp/PageDown by five. Null for any other key. */
export function trackKeyTarget(key: string, activeIndex: number, stopCount: number): number | null {
  const last = stopCount - 1;
  const target = key === "ArrowRight" || key === "ArrowUp" ? activeIndex + 1
    : key === "ArrowLeft" || key === "ArrowDown" ? activeIndex - 1
    : key === "PageUp" ? activeIndex + 5
    : key === "PageDown" ? activeIndex - 5
    : key === "Home" ? 0
    : key === "End" ? last
    : null;
  return target === null ? null : Math.min(last, Math.max(0, target));
}

/** Segment ridden on hop `hop` (stations[hop] -> stations[hop + 1]). A
    transfer station starts the next segment, but the hop INTO it still
    belongs to the line it was ridden on (track-2). */
export function segmentIndexForHop(segmentStarts: readonly number[], hop: number): number {
  return Math.max(0, segmentStarts.findLastIndex((start) => start <= hop));
}
