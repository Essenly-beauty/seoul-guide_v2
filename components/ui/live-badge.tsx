"use client";

import { placeStatus, statusLabel } from "@/lib/places";
import type { Place } from "@/lib/data";

/** Open-now indicator (spec v2 §3.2). Renders `● LIVE until HH:MM` while open,
    the muted closed label otherwise, nothing when hours are unknown. */
export function LiveBadge({ hours, showUntil = true }: { hours?: Place["hours"]; showUntil?: boolean }) {
  if (!hours) return null;
  if (placeStatus(hours) !== "open") {
    return <span className="small muted">{statusLabel(hours)}</span>;
  }
  return (
    <>
      <span className="livebadge">LIVE</span>
      {showUntil && <b className="small">until {hours.close}</b>}
    </>
  );
}
