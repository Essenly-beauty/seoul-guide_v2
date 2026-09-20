"use client";

import { useEffect, useRef, useState } from "react";
import { EXIT_MS, nextExitState, type ExitState } from "@/lib/overlay-dismiss";

/**
 * Keeps an overlay mounted while its exit animation plays.
 *
 * The unmount is driven by a timer, not by `animationend`: the global
 * reduced-motion block sets `animation: none !important`, so that event would
 * never fire and the overlay would stay on screen for good. `matchMedia` is
 * read inside the effect because reading it during render would make the
 * server and client markup disagree.
 */
export function useExitTransition(open: boolean, exitMs: number = EXIT_MS): { mounted: boolean; closing: boolean } {
  const [state, setState] = useState<ExitState>(open ? "open" : "closed");
  const everOpened = useRef(open);

  useEffect(() => {
    if (open) {
      everOpened.current = true;
      setState("open");
      return;
    }
    if (!everOpened.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState((prev) => nextExitState(prev, false, reduced));
    if (reduced) return;
    const timer = window.setTimeout(() => setState("closed"), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted: state !== "closed", closing: state === "closing" };
}
