"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  googleDirectionsUrl,
  kakaoRouteUrl,
  NAVER_MAP_IOS_APP_STORE_URL,
  naverAndroidIntentUrl,
  naverAppRouteUrl,
  naverRouteUrl,
  type LatLng,
} from "@/lib/geo";
import type { Place } from "@/lib/data";

type MobilePlatform = "android" | "ios" | null;

function mobilePlatform(): MobilePlatform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return null;
}

/**
 * Google / Kakao / NAVER route buttons (spec v2 §6).
 *
 * NAVER is a real app hand-off on Android/iOS. Its UI language intentionally
 * follows the visitor's NAVER Map setting rather than overriding it from our
 * URL; users who set NAVER Map to English stay in the English map experience.
 */
export function MapLinkButtons({ place, origin }: {
  place: Pick<Place, "nameKr" | "lat" | "lng">;
  origin?: LatLng | null;
}) {
  const dest = { lat: place.lat, lng: place.lng };
  const [platform, setPlatform] = useState<MobilePlatform>(null);
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    setPlatform(mobilePlatform());
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  const naverHref = (() => {
    if (platform === null) return naverRouteUrl(place.nameKr, dest, origin);
    const appName = window.location.origin;
    if (platform === "android") return naverAndroidIntentUrl(place.nameKr, dest, origin, appName);
    return naverAppRouteUrl(place.nameKr, dest, origin, appName);
  })();

  const tryNaverIos = () => {
    if (platform !== "ios") return;
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
    { label: "Google", href: googleDirectionsUrl(dest, origin), bg: "#4285f4", fg: "#fff" },
    { label: "Kakao", href: kakaoRouteUrl(place.nameKr, dest, origin), bg: "#fae100", fg: "#3c1e1e" },
  ];
  return (
    <>
      {links.map((l) => (
        <Button
          key={l.label}
          size="sm"
          style={{ background: l.bg, color: l.fg, border: "none" }}
          href={l.href}
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
        newTab={platform === null}
        onClick={tryNaverIos}
        aria-label="Open directions in NAVER Map"
      >
        Naver Map
      </Button>
    </>
  );
}
