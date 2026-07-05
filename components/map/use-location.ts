"use client";

import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

type Status = "loading" | "granted" | "fallback";

/** Browser geolocation with an 8s timeout; falls back gracefully. */
export function useLocation(): { loc: LatLng | null; status: Status; retry: () => void } {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("fallback");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => setStatus("fallback"),
      { timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => { request(); }, [request]);

  return { loc, status, retry: request };
}
