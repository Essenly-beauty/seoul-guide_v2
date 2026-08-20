"use client";

import { useEffect, useState } from "react";
import { placeStatus } from "@/lib/places";
import type { Place } from "@/lib/data";

/** Stable open-hours status slot. Every settled state keeps text in the same
    badge family so map rows do not jump and color is never the only signal. */
export function LiveBadge({ hours, showUntil = true }: { hours?: Place["hours"]; showUntil?: boolean }) {
  // Server regions and a visitor's device can be in different timezones. Keep
  // the time-sensitive content out of the shared server/first-client render,
  // then compute it once the visitor's browser has mounted.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!now) {
    return <span className="livebadge loading" aria-hidden="true">LIVE</span>;
  }
  if (!hours) {
    return <span className="livebadge unknown">Hours unknown</span>;
  }
  if (placeStatus(hours, now) !== "open") {
    return <span className="livebadge closed">Closed</span>;
  }
  return (
    <span className="livebadge open">
      Live
      {showUntil && <span className="livebadge-until"> until {hours.close}</span>}
    </span>
  );
}
