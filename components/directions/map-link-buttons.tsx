"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  googleDirectionsUrl,
  kakaoRouteUrl,
  NAVER_MAP_IOS_APP_STORE_URL,
  naverAndroidIntentUrl,
  naverAppRouteUrl,
  naverMapUrl,
  naverRouteUrl,
  type LatLng,
} from "@/lib/geo";
import type { Place } from "@/lib/data";
import { isApproximatePlace } from "@/lib/places";

type MobilePlatform = "android" | "ios" | null;

function mobilePlatform(): MobilePlatform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return null;
}

/**
 * Map searches for approximate pins; route buttons for exact locations.
 *
 * NAVER is a real app hand-off on Android/iOS. Its UI language intentionally
 * follows the visitor's NAVER Map setting rather than overriding it from our
 * URL; users who set NAVER Map to English stay in the English map experience.
 */
export function MapLinkButtons({ place, origin }: {
  // name + address feed the Google hand-off so its route sheet shows the
  // shop, not "핀 고정 위치"; nameKr feeds Kakao (owner report 2026-09-27).
  place: Pick<Place, "nameKr" | "lat" | "lng" | "name" | "address" | "geoSource" | "locationVerification">;
  origin?: LatLng | null;
}) {
  const dest = { lat: place.lat, lng: place.lng };
  const approximate = isApproximatePlace(place);
  const [platform, setPlatform] = useState<MobilePlatform>(null);
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    setPlatform(mobilePlatform());
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  const naverHref = (() => {
    if (approximate) return naverMapUrl(place.nameKr || place.name);
    if (platform === null) return naverRouteUrl(place.nameKr, dest, origin);
    const appName = window.location.origin;
    if (platform === "android") return naverAndroidIntentUrl(place.nameKr, dest, origin, appName);
    return naverAppRouteUrl(place.nameKr, dest, origin, appName);
  })();

  const tryNaverIos = () => {
    if (approximate || platform !== "ios") return;
    const clearFallback = () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
      window.removeEventListener("pagehide", clearFallback);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) clearFallback();
    };

    window.addEventListener("pagehide", clearFallback, { once: true });
    document.addEventListener("visibilitychange", handleVisibilityChange, { once: true });
    fallbackTimer.current = window.setTimeout(() => {
      clearFallback();
      if (!document.hidden) window.location.assign(NAVER_MAP_IOS_APP_STORE_URL);
    }, 1500);
  };

  const links = [
    // Exact places: Google gets the shop by name + address so its route sheet reads
    // "Olive Young Gangnam Town", not "핀 고정 위치"; the origin is left to
    // Google so it reads "내 위치" (owner report 2026-09-27). Kakao keeps
    // the coordinates: its link scheme carries a name alongside them.
    { label: "Google", href: approximate ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.nameKr || place.name)}` : googleDirectionsUrl({ ...dest, name: place.name, address: place.address }), bg: "#4285f4", fg: "#fff" },
    { label: "Kakao", href: approximate ? `https://map.kakao.com/link/search/${encodeURIComponent(place.nameKr || place.name)}` : kakaoRouteUrl(place.nameKr, dest, origin), bg: "#fae100", fg: "#3c1e1e" },
  ];
  return (
    <>
      {links.map((l) => (
        <Button
          key={l.label}
          size="sm"
          style={{ background: l.bg, color: l.fg, border: "none" }}
          href={l.href}
          aria-label={approximate ? `Search for ${place.name} in ${l.label} Maps` : `Open directions in ${l.label} Maps`}
          external
        >
          {l.label}
        </Button>
      ))}
      <Button
        size="sm"
        style={{ background: "#03c75a", color: "#fff", border: "none" }}
        href={naverHref}
        external
        newTab={approximate || platform === null}
        onClick={approximate ? undefined : tryNaverIos}
        aria-label={approximate ? `Search for ${place.name} in NAVER Map` : "Open directions in NAVER Map"}
      >
        Naver Map
      </Button>
    </>
  );
}
