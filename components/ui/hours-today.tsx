"use client";

import { useEffect, useState } from "react";
import { hoursToday } from "@/lib/places";
import type { Place } from "@/lib/data";

/** "09:00 – 22:30 today", resolved against the visitor's own date.
 *
 *  A Vercel server's date can differ from the visitor's, and with per-day hours
 *  the two can now disagree about the *values* and not just the highlight — so
 *  this keeps the time-sensitive text out of the shared server/first-client
 *  render and fills it in after mount, exactly like LiveBadge. The placeholder
 *  holds the row height so nothing jumps. */
export function HoursToday({ hours }: { hours?: Place["hours"] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!now) {
    return <span className="caption muted chev" aria-hidden="true">&nbsp;</span>;
  }
  const today = hoursToday(hours, now);
  return (
    <span className="caption muted chev">
      {today ? `${today.open} – ${today.close} today` : "Closed today"}
    </span>
  );
}
