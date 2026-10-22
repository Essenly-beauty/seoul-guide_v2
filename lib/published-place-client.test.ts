import { afterEach, describe, expect, it, vi } from "vitest";
import type { Place } from "./data";
import type { MerchantMedia } from "./partner/media-contracts";
import { composeLookup, fetchPublishedPlace, isFreshLookup, rememberLookup, type LookupEntry } from "./published-place-lookup";

// The map sheet opens a place from the static catalog and overlays the venue's
// published profile from the two public endpoints. These pin what a lookup may
// and may not do to the catalog data, and what the per-pin memo keeps across
// failures and reselection (codex review 2026-10-20).

const place: Place = {
  id: "client-test-salon", name: "Catalog Salon", nameKr: "카탈로그 살롱", type: "hair_salon",
  zone: "gangnam_station", tags: [], address: "Test street 1", lat: 37.5, lng: 127.03, photos: ["/catalog.webp"],
};

const published = {
  status: "published", placeId: place.id,
  profile: {
    contactPhone: "02-000-0000", contactEmail: "", englishOk: true, notice: "Closed Tuesday", showPhotos: false,
    nameKo: "카탈로그 살롱", nameEn: "Published Salon", address: "Test street 1", introductionKo: "", introductionEn: "",
    updatedAt: "2026-10-20T12:00:00.000Z",
  },
};

const storePhoto: MerchantMedia = {
  id: "11111111-1111-4111-8111-111111111111", targetKind: "store", targetId: null, status: "active",
  url: `/api/places/${place.id}/media/11111111-1111-4111-8111-111111111111`, width: 1200, height: 800,
  createdAt: "2026-10-20T11:00:00.000Z", updatedAt: "2026-10-20T11:00:00.000Z",
};

function stubFetch(routes: Record<string, { status: number; body?: unknown } | Error>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const path = new URL(input, "http://localhost").pathname;
    calls.push(path);
    const route = Object.entries(routes).find(([suffix]) => path.endsWith(suffix))?.[1];
    if (!route) throw new Error(`unexpected fetch ${path}`);
    if (route instanceof Error) throw route;
    return { ok: route.status >= 200 && route.status < 300, status: route.status, json: async () => route.body } as Response;
  }));
  return calls;
}
const signal = () => new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

describe("published place lookup for the map sheet", () => {
  it("overlays the published profile, photo switch and photos onto the catalog entry", async () => {
    const calls = stubFetch({ "/profile": { status: 200, body: published }, "/media": { status: 200, body: { media: [storePhoto] } } });
    const result = await fetchPublishedPlace(place, signal());
    expect(calls.sort()).toEqual([`/api/places/${place.id}/media`, `/api/places/${place.id}/profile`]);
    expect(result?.media).toEqual([storePhoto]);
    const shown = composeLookup(rememberLookup(undefined, result!, 1_000));
    expect(shown).toMatchObject({ id: place.id, name: "Published Salon", englishOk: true, photosEnabled: false, photos: [storePhoto.url] });
    expect(shown.publishedContact).toEqual({ contactPhone: "02-000-0000", contactEmail: "", notice: "Closed Tuesday" });
  });

  it("keeps the catalog entry for a venue with no published profile", async () => {
    stubFetch({ "/profile": { status: 200, body: { status: "unpublished", placeId: place.id } }, "/media": { status: 200, body: { media: [] } } });
    const result = await fetchPublishedPlace(place, signal());
    expect(result).toEqual({ profile: place, media: [] });
    expect(composeLookup(rememberLookup(undefined, result!, 1_000))).toEqual(place);
  });

  it("reports a failed profile lookup as null instead of passing catalog defaults off as the venue's settings", async () => {
    stubFetch({ "/profile": { status: 503, body: { code: "BOOKING_SERVICE_UNAVAILABLE" } }, "/media": { status: 200, body: { media: [] } } });
    expect(await fetchPublishedPlace(place, signal())).toBeNull();
    stubFetch({ "/profile": new Error("network down"), "/media": { status: 200, body: { media: [] } } });
    expect(await fetchPublishedPlace(place, signal())).toBeNull();
  });

  it("still delivers the venue's settings when only the photo lookup failed", async () => {
    stubFetch({ "/profile": { status: 200, body: published }, "/media": new Error("network down") });
    const result = await fetchPublishedPlace(place, signal());
    expect(result?.media).toBeNull();
    expect(result?.profile).toMatchObject({ name: "Published Salon", photosEnabled: false });
  });

  it("ignores a profile that belongs to another place", async () => {
    stubFetch({ "/profile": { status: 200, body: { ...published, placeId: "someone-else" } }, "/media": { status: 200, body: { media: [] } } });
    expect(await fetchPublishedPlace(place, signal())).toEqual({ profile: place, media: [] });
  });
});

describe("per-pin memo", () => {
  const offProfile: LookupEntry["profile"] = { ...place, name: "Published Salon", photosEnabled: false };
  const onProfile: LookupEntry["profile"] = { ...place, name: "Published Salon", photosEnabled: true };

  it("keeps the last good photos when a later lookup lost them, and the new profile wins", () => {
    const first = rememberLookup(undefined, { profile: onProfile, media: [storePhoto] }, 1_000);
    const partial = rememberLookup(first, { profile: offProfile, media: null }, 2_000);
    expect(partial.media).toEqual([storePhoto]);
    expect(composeLookup(partial)).toMatchObject({ photosEnabled: false, photos: [storePhoto.url] });
    // carried-over photos are shown but never fresh: the pin keeps its quick retry
    expect(isFreshLookup(first, 1_500)).toBe(true);
    expect(isFreshLookup(partial, 2_500)).toBe(false);
  });

  it("remembers a venue's OFF received without photos, so reselecting the pin shows it even if that lookup fails", () => {
    const partial = rememberLookup(undefined, { profile: offProfile, media: null }, 1_000);
    expect(composeLookup(partial)).toMatchObject({ photosEnabled: false, photos: ["/catalog.webp"] });
    expect(isFreshLookup(partial, 1_500)).toBe(false); // shown, but read again rather than trusted for a minute
  });

  it("treats a complete recent entry as fresh and an old one as stale", () => {
    const entry = rememberLookup(undefined, { profile: onProfile, media: [] }, 1_000);
    expect(isFreshLookup(entry, 30_000)).toBe(true);
    expect(isFreshLookup(entry, 61_001)).toBe(false);
    expect(isFreshLookup(undefined, 1_000)).toBe(false);
  });
});
