"use client";

import { useEffect, useState } from "react";
import { placeStatus, statusLabel } from "@/lib/places";
import type { Place } from "@/lib/data";

/** Open-now indicator (spec v2 §3.2). Renders `● LIVE until HH:MM` while open,
    the muted closed label otherwise, nothing when hours are unknown. */
export function LiveBadge({ hours, showUntil = true }: { hours?: Place["hours"]; showUntil?: boolean }) {
  // Server regions and a visitor's device can be in different timezones. Keep
  // the time-sensitive content out of the shared server/first-client render,
  // then compute it once the visitor's browser has mounted.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!hours || !now) return null;
  if (placeStatus(hours, now) !== "open") {
    return <span className="small muted">{statusLabel(hours, now)}</span>;
  }
  return (
    <>
      <span className="livebadge">LIVE</span>
      {showUntil && <b className="small">until {hours.close}</b>}
    </>
  );
}
