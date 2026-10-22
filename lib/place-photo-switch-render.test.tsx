import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { ToastProvider } from "@/components/ui/toast";
import type { PublishedPlace } from "@/lib/place-profile";

// Feasibility check (PASSES today): the repo's existing SSR harness
// (lib/place-trust-render.test.tsx) can pin owner decision 2 directly, yet no
// test in the repo renders photosEnabled=false.
vi.mock("next/navigation", () => ({ useRouter: () => ({ back() {}, push() {} }), usePathname: () => "/map" }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: null, loading: false }) }));

const place: PublishedPlace = {
  id: "switch-test", name: "Switch Salon", nameKr: "스위치 살롱", type: "hair_salon",
  zone: "gangnam_station", tags: [], address: "Test street", lat: 37.5, lng: 127.03, geoSource: "address",
  photos: ["/places/switch-test/1.webp", "/places/switch-test/2.webp"],
};
const render = (p: PublishedPlace) => load(renderToStaticMarkup(<ToastProvider><PlaceDetailBody place={p} /></ToastProvider>));

describe("photo header switch (owner decision 2)", () => {
  it("shows the collage by default and hides it when the venue switched it off", () => {
    expect(render(place)(".place-photo-collage img")).toHaveLength(2);
    const off = render({ ...place, photosEnabled: false });
    expect(off(".place-photo-collage")).toHaveLength(0);
    expect(off(".place-hero-chrome")).toHaveLength(1);
  });
});

import { readFileSync } from "node:fs";
describe("map sheet shows the venue's published profile on every selected-place surface (tests-4, published-2)", () => {
  const sheet = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");
  const summary = (variant: string) => { const end = sheet.indexOf(`variant="${variant}"`); return sheet.slice(sheet.lastIndexOf("<SelectedPlaceSummary", end), end); };
  it("compact and half summaries, detail body, CTA bar, action bar and the collapsed handle label", () => {
    expect(sheet).toContain("const publishedPlace = usePublishedPlace(selectedPlace);");
    expect(summary("compact")).toContain("place={publishedPlace ?? selectedPlace}");
    expect(summary("half")).toContain("place={publishedPlace ?? selectedPlace}");
    expect(sheet).toMatch(/<PlaceDetailBody\s+place=\{publishedPlace \?\? selectedPlace\}/);
    expect(sheet).toContain("<PlaceCtaBar place={publishedPlace ?? selectedPlace} />");
    expect(sheet).toContain("<SelectedPlaceActionBar place={publishedPlace ?? selectedPlace} />");
    expect(sheet).toContain("Selected place preview collapsed. ${(publishedPlace ?? selectedPlace)?.name");
  });
});
