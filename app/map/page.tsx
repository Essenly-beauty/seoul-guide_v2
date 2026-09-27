import type { Metadata } from "next";
import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";
import { BottomNav } from "@/components/ui/bottom-nav";

const BASE_META: Metadata = {
  title: "MYSEOULDROP",
  description: "Find Seoul beauty spots on the map. Sign in to open a shared list.",
  openGraph: {
    title: "MYSEOULDROP",
    description: "Find Seoul beauty spots on the map. Sign in to open a shared list.",
  },
  twitter: {
    card: "summary",
    title: "MYSEOULDROP",
    description: "Find Seoul beauty spots on the map. Sign in to open a shared list.",
  },
};

// List previews stay generic; crawlers and guests cannot read snapshot metadata.
export async function generateMetadata(
  _props: { searchParams: Promise<{ list?: string }> },
): Promise<Metadata> {
  return BASE_META;
}

export default function MapPage() {
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {/* MapScreen reads useSearchParams (?place= deep link) — needs a Suspense boundary.
            The fallback paints a static snapshot of the initial view straight
            from the SSR HTML — it becomes the LCP element at FCP time instead
            of waiting for the Leaflet chunk (perf, 2026-08-15). Theme-gated
            via CSS so dark users see their own snapshot. */}
        <Suspense
          fallback={
            <div className="map-canvas" aria-label="Loading map">
              {/* plain <img> on purpose: fixed local snapshot on the LCP
                  critical path — next/image's loader indirection only delays it */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="map-ph map-ph-light" src="/map-placeholder-light.jpg" alt="" fetchPriority="high" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="map-ph map-ph-dark" src="/map-placeholder-dark.jpg" alt="" />
            </div>
          }
        >
          <MapScreen />
        </Suspense>
      </div>
      <BottomNav active="map" />
    </>
  );
}
