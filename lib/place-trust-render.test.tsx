import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { MapLinkButtons } from "@/components/directions/map-link-buttons";
import { SelectedPlaceSummary } from "@/components/map/selected-place-summary";
import { MapSheet } from "@/components/map/map-sheet";
import { ToastProvider } from "@/components/ui/toast";
import { PLACES, type Place } from "./data";
import * as places from "./places";

// Next's router context is supplied by the application, outside the SSR subject.
vi.mock("next/navigation", () => ({ useRouter: () => ({ back() {}, push() {} }), usePathname: () => "/map" }));
// Authentication is unrelated to the public information rendered here.
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: null, loading: false }) }));

const salon: Place = {
  id: "trust-test", name: "Test Salon", nameKr: "테스트 살롱", type: "hair_salon",
  zone: "gangnam_station", tags: [], address: "Test street", lat: 37.5, lng: 127.03,
  source: "creatrip", url: "https://creatrip.com/en/spot/12345", geoSource: "address",
  services: [{ name: "Illustrative cut", price: "₩99,999", durationMin: 90 }],
  stationWalk: { station: "Gangnam", minutes: 4 },
};

function detail(place: Place) {
  return load(renderToStaticMarkup(<ToastProvider><PlaceDetailBody place={place} /></ToastProvider>));
}

describe("place information trust", () => {
  it("recognizes either approximate-location signal", () => {
    expect(places).toHaveProperty("isApproximatePlace");
    const isApproximate = places.isApproximatePlace;
    expect(isApproximate({ geoSource: "area" })).toBe(true);
    expect(isApproximate({ locationVerification: "provisional" })).toBe(true);
    expect(isApproximate({ geoSource: "address", locationVerification: "verified" })).toBe(false);
    expect(isApproximate({})).toBe(false);
  });

  it("does not present category examples as a salon's services or prices", () => {
    const $ = detail(salon);
    expect($("#d-services").text()).toContain("Services and prices not verified");
    expect($("#d-services").text()).not.toContain("Illustrative cut");
    expect($("#d-services").text()).not.toContain("₩99,999");
    expect($("#d-services a").attr("href")).toBe(salon.url);
    expect($("#d-services a").text()).toContain("Creatrip");
  });

  it("states missing source links explicitly without calling a salon walk-in retail", () => {
    const $ = detail({ ...salon, url: undefined, services: undefined });
    expect($("#d-services").text()).not.toContain("Walk-in retail");
    expect($("#d-services").text()).toContain("Listing link unavailable");
    expect($("#d-info").text()).toContain("Creatrip");
    expect($("#d-info").text()).toContain("Listing link unavailable");
  });

  it.each([
    ["creatrip", "Creatrip"], ["ados", "A drop of Seoul"], ["kakao", "Kakao Map"],
    ["olive_young", "Olive Young store finder"], ["daiso", "Daiso store finder"],
    ["curated", "MYSEOULDROP curation"],
  ] as const)("names the actual %s listing source without inventing a verification date", (source, label) => {
    const $ = detail({ ...salon, source });
    const sourceLink = $("#d-info a").filter((_, el) => $(el).attr("href") === salon.url);
    expect(sourceLink.text()).toContain(label);
    expect($("#d-info").text()).not.toMatch(/verified on|last verified|2026-/i);
  });

  it.each([{ geoSource: "area" as const }, { locationVerification: "provisional" as const }])("warns before approximate-location guidance: %j", (uncertainty) => {
    const $ = detail({ ...salon, ...uncertainty });
    expect($(".place-address-disclosure").text()).toContain("Approximate pin");
    expect($(".place-address-disclosure").text()).not.toMatch(/\d+(?:\.\d+)?\s*(?:km|m)\b/);
    expect($(".taxicard").length).toBe(0);
    expect($("#d-home").text()).not.toContain("min walk");
  });

  it("preserves exact-location distance and taxi guidance", () => {
    const $ = detail(salon);
    expect($(".place-address-disclosure .mono").text()).toMatch(/\d/);
    expect($(".taxicard").length).toBe(1);
    expect($("#d-home").text()).toContain("4 min walk");
  });

  it("distinguishes imported listing ratings from traveler reviews without inventing their original platform", () => {
    const $ = detail({ ...salon, rating: 4.7, ratingCount: 123 });
    expect($("#d-reviews").text()).toContain("Imported listing rating");
    expect($("#d-reviews").text()).not.toMatch(/Google reviews|verified reviews/i);
  });

  it("shows neutral nearby choices without ordinal ranking or synthetic ratings", () => {
    const $ = detail({ ...salon, geoSource: "area" });
    const nearby = $("section").filter((_, section) => $(section).find("h2").text().startsWith("Nearby places"));
    expect(nearby.length).toBe(1);
    expect(nearby.text()).not.toContain("Top rated");
    expect(nearby.find(".listrow > .mono").length).toBe(0);
    expect(nearby.text()).not.toMatch(/\d+(?:\.\d+)?\s*(?:km|m)\b/);
    expect(nearby.find("a").length).toBe(4);
  });

  it("omits distance for an approximate nearby candidate even when the base is exact", () => {
    const candidate = PLACES.find((p) => p.geoSource === "area")!;
    const $ = detail({ ...salon, type: candidate.type, lat: candidate.lat, lng: candidate.lng });
    const nearby = $("section").filter((_, section) => $(section).find("h2").text().startsWith("Nearby places"));
    const row = nearby.find(`a[href="/place/${candidate.id}"]`);
    expect(row.length).toBe(1);
    expect(row.text()).toContain("Approximate pin");
    expect(row.text()).not.toMatch(/\d+(?:\.\d+)?\s*(?:km|m)\b/);
  });

  it("retains sourced Daiso charts while Olive Young picks are an unnumbered product guide", () => {
    const oy = detail({ ...salon, type: "olive_young" });
    expect(oy("#d-services").text()).toContain("product guide");
    expect(oy("#d-services").text()).not.toMatch(/ranking|every week/i);
    expect(oy("#d-services .listrow > .num").length).toBe(0);
    const daiso = detail({ ...salon, type: "daiso", source: "daiso" });
    expect(daiso("#d-services").text()).toContain("Daiso Mall ranking");
    expect(daiso("#d-services .listrow > .num").length).toBe(4);
  });
});

describe("approximate places across map surfaces", () => {
  it("does not display synthetic curated ratings in map previews or list rows", () => {
    const curated = { ...salon, source: "curated" as const, rating: 4.9, ratingCount: 999 };
    for (const variant of ["half", "compact"] as const) {
      const $ = load(renderToStaticMarkup(<SelectedPlaceSummary place={curated} km={0.42} variant={variant} />));
      expect($(".stars").length).toBe(0);
    }
    const $ = load(renderToStaticMarkup(<MapSheet places={[curated]} origin={salon} selectedId={null} onSelect={() => {}} onClearSelection={() => {}} />));
    expect($(".stars").length).toBe(0);
  });
  it.each(["half", "compact"] as const)("replaces distance with a warning in the %s summary", (variant) => {
    const $ = load(renderToStaticMarkup(<SelectedPlaceSummary place={{ ...salon, geoSource: "area" }} km={0.42} variant={variant} />));
    expect($.text()).toContain("Approximate pin");
    expect($.text()).not.toContain("420m");
  });

  it("hides approximate distances in standard and coordinate-choice map rows", () => {
    const approximate = { ...salon, geoSource: "area" as const };
    const html = renderToStaticMarkup(<MapSheet places={[approximate, { ...salon, id: "exact-test" }]} origin={salon} selectedId={null} onSelect={() => {}} onClearSelection={() => {}} />);
    const $ = load(html);
    expect($(".maprow").first().text()).toContain("Approximate pin");
    expect($(".maprow").first().text()).not.toMatch(/\d+(?:\.\d+)?(?:km|m)\b/);
    const grouped = PLACES.filter((p) => p.geoSource === "area").slice(0, 2);
    const group = load(renderToStaticMarkup(<MapSheet places={grouped} groupPlaceIds={grouped.map(p => p.id)} origin={salon} selectedId={null} onSelect={() => {}} onClearSelection={() => {}} />));
    expect(group(".maprow-coordinate-choice")).toHaveLength(2);
    expect(group(".maprow-coordinate-choice").first().text()).toContain("Approximate pin");
  });

  it.each([{ geoSource: "area" as const }, { locationVerification: "provisional" as const }])("opens name searches instead of coordinate directions: %j", (uncertainty) => {
    const $ = load(renderToStaticMarkup(<MapLinkButtons place={{ ...salon, ...uncertainty }} origin={{ lat: 37.1, lng: 127.1 }} />));
    const links = $("a").toArray().map(a => ({ href: $(a).attr("href")!, label: $(a).attr("aria-label"), target: $(a).attr("target") }));
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.href).toContain("search");
      expect(decodeURIComponent(link.href)).toMatch(/Test Salon|테스트 살롱/);
      expect(link.href).not.toMatch(/37\.5|127\.03|route|directions|\/dir\/|nmap:|intent:/);
      expect(link.label).toMatch(/^Search /);
      expect(link.target).toBe("_blank");
    }
  });

  it("keeps exact Google destinations named and lets Google choose the device origin", () => {
    const $ = load(renderToStaticMarkup(<MapLinkButtons place={salon} origin={{ lat: 37.1, lng: 127.1 }} />));
    const url = new URL($("a").first().attr("href")!);
    expect(url.pathname).toContain("/dir/");
    expect(url.searchParams.get("destination")).toBe("Test Salon, Test street");
    expect(url.searchParams.has("origin")).toBe(false);
  });
});
