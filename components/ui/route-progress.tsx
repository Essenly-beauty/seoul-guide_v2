"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Route-change loading sweep. Renders nothing itself — it stamps a class on
    <html> so each page's own header bottom edge (.topbar::after) carries the
    moving gradient (user request 2026-08-02: on the header line, smooth). */
export function RouteProgress() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("route-sweep");
    // restart the CSS animation even for rapid consecutive navigations
    void root.offsetWidth;
    root.classList.add("route-sweep");
    const timer = window.setTimeout(() => root.classList.remove("route-sweep"), 1300);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
