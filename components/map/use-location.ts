"use client";

import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

type Status = "loading" | "granted" | "fallback";
type OrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const normalizeHeading = (value: number) => ((value % 360) + 360) % 360;

function orientationConstructor(): OrientationEventConstructor | null {
  if (typeof window === "undefined" || !window.DeviceOrientationEvent) return null;
  return window.DeviceOrientationEvent as OrientationEventConstructor;
}

/** Browser geolocation with an 8s timeout; falls back gracefully. */
export function useLocation(): {
  loc: LatLng | null;
  status: Status;
  heading: number | null;
  retry: () => void;
  requestHeading: () => void;
} {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [heading, setHeading] = useState<number | null>(null);
  const [orientationAllowed, setOrientationAllowed] = useState(false);

  const enableOrientation = useCallback(async () => {
    const ctor = orientationConstructor();
    if (!ctor) return;
    if (typeof ctor.requestPermission === "function") {
      try {
        if (await ctor.requestPermission() !== "granted") return;
      } catch {
        return;
      }
    }
    setOrientationAllowed(true);
  }, []);

  // Browsers without a permission-gated orientation API can be listened to as
  // soon as the map mounts. iOS Safari enables it from the explicit retry tap.
  useEffect(() => {
    const ctor = orientationConstructor();
    if (ctor && typeof ctor.requestPermission !== "function") setOrientationAllowed(true);
  }, []);

  useEffect(() => {
    if (!orientationAllowed || typeof window === "undefined") return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      const compass = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const next = typeof compass === "number"
        ? compass
        : typeof event.alpha === "number"
          ? 360 - event.alpha
          : null;
      if (next !== null && Number.isFinite(next)) setHeading(normalizeHeading(next));
    };
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
    window.addEventListener("deviceorientation", onOrientation as EventListener, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
      window.removeEventListener("deviceorientation", onOrientation as EventListener, true);
    };
  }, [orientationAllowed]);

  const request = useCallback((interactive = false) => {
    if (interactive) void enableOrientation();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("fallback");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (typeof pos.coords.heading === "number" && Number.isFinite(pos.coords.heading)) {
          setHeading(normalizeHeading(pos.coords.heading));
        }
        setStatus("granted");
      },
      () => setStatus("fallback"),
      { timeout: 8000, maximumAge: 60000 },
    );
  }, [enableOrientation]);

  useEffect(() => { request(); }, [request]);

  const retry = useCallback(() => request(true), [request]);
  const requestHeading = useCallback(() => { void enableOrientation(); }, [enableOrientation]);
  return { loc, status, heading, retry, requestHeading };
}
