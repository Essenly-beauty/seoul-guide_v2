import { beforeEach, describe, expect, it, vi } from "vitest";

// rpc-1: /place/[id] (getPublishedPlace) merges the venue's store photos even
// when the profile read (which carries show_photos) failed.
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), media: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/partner/media-server", () => ({ getPublicMerchantMedia: mocks.media }));

const photoId = "a5000000-0000-4000-8000-000000000001";
const ts = "2026-10-20T10:00:00.123456+00:00";

beforeEach(() => { vi.resetModules(); mocks.rpc.mockReset(); mocks.media.mockReset(); });

async function setup(rpcResult: unknown) {
  const { PLACES } = await import("@/lib/data");
  const place = PLACES[0];
  const url = `/api/places/${place.id}/media/${photoId}`;
  mocks.rpc.mockImplementation(async () => (typeof rpcResult === "function" ? (rpcResult as (id: string) => unknown)(place.id) : rpcResult));
  mocks.media.mockResolvedValue([{ id: photoId, targetKind: "store", targetId: null, status: "active", url, width: 10, height: 10, createdAt: ts, updatedAt: ts }]);
  const { getPublishedPlace } = await import("@/lib/place-profile-server");
  const result = await getPublishedPlace(place.id);
  return { result, url };
}
const shownInHeader = (r: unknown, url: string) => ((p: { photosEnabled?: boolean; photos?: readonly string[] } | undefined) =>
  p?.photosEnabled !== false && (p?.photos ?? []).includes(url))(r as { photosEnabled?: boolean; photos?: readonly string[] } | undefined);

const offProfile = (placeId: string, contactPhone: string) => ({ data: { status: "published", placeId, profile: {
  contactPhone, contactEmail: "", englishOk: false, notice: "", showPhotos: false,
  nameKo: "Venue", nameEn: "", address: "Seoul", introductionKo: "", introductionEn: "", updatedAt: ts } }, error: null });

describe("rpc-1 server twin photo switch", () => {
  it("baseline: OFF profile read successfully hides the store photos", async () => {
    const { result, url } = await setup((id: string) => offProfile(id, "02-555-1234"));
    expect((result as { photosEnabled?: boolean } | undefined)?.photosEnabled).toBe(false);
    expect(shownInHeader(result, url)).toBe(false);
  });

  it("transient profile RPC error must not re-show the hidden store photos", async () => {
    const { result, url } = await setup({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
    expect(shownInHeader(result, url)).toBe(false);
  });

  it("DB-valid OFF row with phone '02-555-1234~5' (merchants check: length<=80) must keep photos hidden", async () => {
    const { result, url } = await setup((id: string) => offProfile(id, "02-555-1234~5"));
    expect(shownInHeader(result, url)).toBe(false);
  });
});
