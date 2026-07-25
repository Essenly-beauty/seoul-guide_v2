"use client";

import { useEffect } from "react";
import { MapLinkButtons } from "@/components/directions/map-link-buttons";
import { useLocation } from "@/components/map/use-location";
import { queuePriorityQuestion } from "@/lib/profile";
import type { Place } from "@/lib/data";

/** Sticky bottom CTA (spec §4.6-12): route-only — [Google][Kakao][Naver].
    Share + save moved into the Kakao-style action strip under the title header
    (user decision 2026-07-25), so the bar no longer duplicates them.
    No standalone Directions CTA (confirmed); booking lives in the detail body. */
export function PlaceCtaBar({ place }: { place: Place }) {
  const { loc } = useLocation();

  // Context trigger #1 (docs §4-2), simplified: the spec queues the category
  // question on *first favorite* of a clinic/salon, but the shared
  // FavoriteButton exposes no onClick and stays untouched — so *viewing* a
  // clinic/salon queues the matching question for the My-page card instead.
  // queuePriorityQuestion is a no-op once the field is answered.
  useEffect(() => {
    if (place.type === "skin_clinic") queuePriorityQuestion("skinType");
    else if (place.type === "hair_salon") queuePriorityQuestion("hairType");
  }, [place.type]);

  return (
    <div className="bookbar" style={{ gap: 8 }}>
      {/* .bookbar .btn { flex: 1 } stretches each map link across the bar */}
      <MapLinkButtons place={place} origin={loc} />
    </div>
  );
}
