import type { Metadata } from "next";
import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";
import { BottomNav } from "@/components/ui/bottom-nav";

const BASE_META: Metadata = { title: "Map — MYSEOULDROP" };

// Shared-list links (/map?list={uuid}) get a real preview card in
// KakaoTalk/iMessage — title + place count from the snapshot row.
// Anon REST read of the public-select table; any failure falls back
// to the plain map meta.
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ list?: string }> },
): Promise<Metadata> {
  const { list } = await searchParams;
  if (!list || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(list)) return BASE_META;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return BASE_META;
  try {
    const res = await fetch(
      `${url}/rest/v1/shared_lists?id=eq.${list}&select=title,place_ids`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } },
    );
    if (!res.ok) return BASE_META;
    const row = (await res.json() as Array<{ title: string; place_ids: string[] }>)[0];
    if (!row) return BASE_META;
    const count = row.place_ids?.length ?? 0;
    const title = `${row.title} — MYSEOULDROP`;
    const description = `${count} saved place${count === 1 ? "" : "s"} in Seoul, shared with you — open the list on the map.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return BASE_META;
  }
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
