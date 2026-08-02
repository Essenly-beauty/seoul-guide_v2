"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Top loading line — a soft-gradient primary streak sweeps right on every
    route change (user request 2026-08-02). Purely decorative. */
export function RouteProgress() {
  const pathname = usePathname();
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    setSweep((n) => n + 1);
    const timer = window.setTimeout(() => setSweep(0), 1000);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (sweep === 0) return null;
  return <div key={sweep} className="route-progress" aria-hidden="true" />;
}
