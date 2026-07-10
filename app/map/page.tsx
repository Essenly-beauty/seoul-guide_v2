import type { Metadata } from "next";
import { MapScreen } from "@/components/map/map-screen";
import { BottomNav } from "@/components/ui/bottom-nav";

export const metadata: Metadata = { title: "Map — Essenly" };

export default function MapPage() {
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <MapScreen />
      </div>
      <BottomNav active="map" />
    </>
  );
}
