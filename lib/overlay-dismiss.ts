// Mount lifecycle for overlays that animate out.
//
// The node has to outlive `open === false` for as long as the exit animation
// runs. The unmount is driven by a timer rather than `animationend`, because
// the global reduced-motion block in app/globals.css sets
// `animation: none !important` — that event would never fire and the overlay
// would stay on screen for good.

export type ExitState = "closed" | "open" | "closing";

/** Material 3 "emphasized accelerate": exits are quicker than entrances. */
export const EXIT_MS = 200;

export function nextExitState(prev: ExitState, open: boolean, reducedMotion: boolean): ExitState {
  if (open) return "open";
  if (prev === "closed") return "closed"; // never opened — nothing to play out
  if (reducedMotion) return "closed";
  return "closing";
}
