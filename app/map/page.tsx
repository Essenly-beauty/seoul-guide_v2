import type { Metadata } from "next";
import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";
import { BottomNav } from "@/components/ui/bottom-nav";

export const metadata: Metadata = { title: "Map — Essenly" };

export default function MapPage() {
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {/* MapScreen reads useSearchParams (?place= deep link) — needs a Suspense boundary. */}
        <Suspense fallback={<div className="map-canvas hero-img" aria-label="Loading map" />}>
          <MapScreen />
        </Suspense>
      </div>
      <BottomNav active="map" />
    </>
  );
}
