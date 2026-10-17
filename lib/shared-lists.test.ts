import { afterEach, describe, expect, it, vi } from "vitest";
import { PLACES } from "@/lib/data";
import {
  LIST_PLACES_MAX,
  LIST_TITLE_MAX,
  fetchSharedList,
  listOwnSharedLists,
  revokeSharedList,
  looksLikeListId,
  sanitizeListPlaceIds,
  sanitizeListTitle,
  sharedListUrl,
} from "@/lib/shared-lists";

const browserMocks = vi.hoisted(() => ({ browser: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: browserMocks.browser }));

afterEach(() => vi.unstubAllGlobals());

describe("shared list sanitizers", () => {
  it("trims, collapses whitespace, and falls back on empty titles", () => {
    expect(sanitizeListTitle("  Seoul   weekend  ")).toBe("Seoul weekend");
    expect(sanitizeListTitle("")).toBe("My Seoul list");
    expect(sanitizeListTitle("   ")).toBe("My Seoul list");
    expect(sanitizeListTitle(null)).toBe("My Seoul list");
    expect(sanitizeListTitle("x".repeat(200))).toHaveLength(LIST_TITLE_MAX);
  });

  it("keeps only real place ids, deduped and capped", () => {
    const real = PLACES.slice(0, 3).map((p) => p.id);
    expect(sanitizeListPlaceIds([real[0], "nope", real[0], real[1], real[2]])).toEqual(real);
    const flood = PLACES.map((p) => p.id);
    expect(sanitizeListPlaceIds(flood).length).toBeLessThanOrEqual(LIST_PLACES_MAX);
  });

  it("builds the /map?list= capability URL", () => {
    expect(sharedListUrl("https://myseouldrop.app", "abc-123")).toBe("https://myseouldrop.app/map?list=abc-123");
  });

  it("recognizes uuid-shaped list ids only", () => {
    expect(looksLikeListId("2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182")).toBe(true);
    expect(looksLikeListId("hello")).toBe(false);
    expect(looksLikeListId("")).toBe(false);
    expect(looksLikeListId("2f9c1a34-9c1d-4e7a-b1f2-3d4e5f60718g")).toBe(false);
  });
});

describe("shared list recipient fetch", () => {
  const id = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";

  it("does not request a malformed link", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await fetchSharedList("not-a-uuid")).toEqual({ status: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks a guest to sign in and never reads the table directly", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchSharedList(id)).toEqual({ status: "sign-in" });
    expect(fetch).toHaveBeenCalledWith(`/api/shared-lists/${id}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("returns the known places from one successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      id,
      title: "Seoul weekend",
      place_ids: ["namdaemun-market", "not-a-real-place"],
      created_at: "2026-09-26T00:00:00+00:00",
    })));
    expect(await fetchSharedList(id)).toEqual({
      status: "ok",
      list: { id, title: "Seoul weekend", placeIds: ["namdaemun-market"], unavailablePlaceCount: 1, createdAt: "2026-09-26T00:00:00+00:00" },
    });
  });

  it("keeps an existing link valid when all old places are unpublished", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      id,
      title: "Earlier Seoul list",
      place_ids: ["juno-hair-gangnam", "colorlab-gangnam"],
      created_at: "2026-08-19T00:00:00+00:00",
    })));
    expect(await fetchSharedList(id)).toEqual({
      status: "ok",
      list: {
        id,
        title: "Earlier Seoul list",
        placeIds: [],
        unavailablePlaceCount: 2,
        createdAt: "2026-08-19T00:00:00+00:00",
      },
    });
  });

  it.each([400, 404])("marks a %i response unavailable", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(await fetchSharedList(id)).toEqual({ status: "unavailable" });
  });

  it.each([500, 503])("offers retry for a %i response", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(await fetchSharedList(id)).toEqual({ status: "retry" });
  });

  it("offers retry after a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchSharedList(id)).toEqual({ status: "retry" });
  });
});

describe("owned share links", () => {
  const newer = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";
  const older = "1f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";

  it("lists only the signed-in owner's snapshots newest first", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({ data: [
      { id: newer, title: "New", place_ids: ["namdaemun-market"], created_at: "2026-09-26T00:00:00+00:00" },
      { id: older, title: "Old", place_ids: ["juno-hair-gangnam"], created_at: "2026-09-25T00:00:00+00:00" },
    ], error: null });
    const from = vi.fn().mockReturnValue(builder);
    browserMocks.browser.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user" } } }) },
      from,
    });

    const rows = await listOwnSharedLists();
    expect(rows.map((row) => row.id)).toEqual([newer, older]);
    expect(rows[1].placeIds).toEqual([]);
    expect(rows[1].unavailablePlaceCount).toBe(1);
    expect(from).toHaveBeenCalledWith("shared_lists");
    expect(builder.select).toHaveBeenCalledWith("id, title, place_ids, created_at");
    expect(builder.eq).toHaveBeenCalledWith("owner", "owner-user");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("surfaces list-query failures instead of displaying an empty list", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } }) };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    browserMocks.browser.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user" } } }) },
      from: vi.fn().mockReturnValue(builder),
    });
    await expect(listOwnSharedLists()).rejects.toMatchObject({ message: "offline" });
  });

  it("does not report success when revoke affects no owned row", async () => {
    const builder = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    browserMocks.browser.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user" } } }) },
      from: vi.fn().mockReturnValue(builder),
    });
    await expect(revokeSharedList(newer)).rejects.toThrow();
    expect(builder.eq).toHaveBeenCalledWith("id", newer);
    expect(builder.eq).toHaveBeenCalledWith("owner", "owner-user");
  });

  it("confirms deletion only when the owned row was returned", async () => {
    const builder = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: newer }, error: null }) };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    browserMocks.browser.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user" } } }) },
      from: vi.fn().mockReturnValue(builder),
    });
    await expect(revokeSharedList(newer)).resolves.toBeUndefined();
    expect(builder.select).toHaveBeenCalledWith("id");
  });
});
