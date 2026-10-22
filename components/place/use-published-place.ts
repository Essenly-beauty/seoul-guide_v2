"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/data";
import type { PublishedPlace } from "@/lib/place-profile";
import { FRESH_MS, canHavePublishedProfile, composeLookup, fetchPublishedPlace, isFreshLookup, rememberLookup, retryDelay, type LookupEntry } from "@/lib/published-place-lookup";

// One memo per pin for the page's lifetime. The profile part is remembered
// whenever it was received, the photo part whenever it was; a reselected pin
// therefore shows a venue's OFF switch even if its photo lookup had failed.
const memo = new Map<string, LookupEntry>();

/** The place with its published profile merged in, or the static place until
    the public endpoints answer. A fresh memo (under a minute, photos known)
    answers at once; while a pin stays selected it is re-read every minute —
    sooner after a failure — so a change made in the partner admin shows
    without reselecting the pin. A failed profile lookup keeps the last good
    answer and is not memoized. */
export function usePublishedPlace(place: Place | null): PublishedPlace | null {
  const [published, setPublished] = useState<PublishedPlace | null>(null);
  useEffect(() => {
    // A pin whose id can never be published (every Olive Young and Daiso
    // branch) has nothing to look up: the catalog entry is the answer.
    if (!place || !canHavePublishedProfile(place.id)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let waitingForVisible = false;
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    const schedule = (ms: number) => { timer = setTimeout(() => { void load(); }, ms); };
    const load = async () => {
      if (hidden()) { waitingForVisible = true; return; } // re-read once the page is visible again
      const now = Date.now();
      const cached = memo.get(place.id);
      if (isFreshLookup(cached, now)) {
        setPublished(composeLookup(cached));
        schedule(FRESH_MS - (now - cached.at));
        return;
      }
      const result = await fetchPublishedPlace(place, controller.signal);
      if (controller.signal.aborted) return;
      if (result) {
        const entry = rememberLookup(memo.get(place.id), result, Date.now());
        memo.set(place.id, entry);
        setPublished(composeLookup(entry));
      }
      failures = result?.media ? 0 : failures + 1;
      schedule(result?.media ? FRESH_MS : retryDelay(failures));
    };
    const onVisibility = () => { if (waitingForVisible && !hidden()) { waitingForVisible = false; void load(); } };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [place]);
  if (!place) return null;
  // A stale answer for the previous pin never shows under the new one; a
  // remembered one for this pin shows before the effect's first answer.
  if (published?.id === place.id) return published;
  const cached = memo.get(place.id);
  return cached ? composeLookup(cached) : place;
}
