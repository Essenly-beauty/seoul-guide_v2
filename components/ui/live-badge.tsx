"use client";

import { useEffect, useState } from "react";
import { hoursToday, placeStatus } from "@/lib/places";
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
  // "until" has to be today's closing time, not a week-wide one: a place that
  // shuts at 20:00 on Sundays must not advertise its 22:30 weekday close.
  const until = hoursToday(hours, now);
  return (
    <span className="livebadge open">
      Live
      {showUntil && until && <span className="livebadge-until"> until {until.close}</span>}
    </span>
  );
}
