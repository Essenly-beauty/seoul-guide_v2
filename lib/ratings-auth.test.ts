import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), uid: null as string | null, authChange: null as null | ((event: string, session: null) => void) }));
vi.mock("react", () => ({ useSyncExternalStore: (subscribe: (cb: () => void) => unknown, get: () => unknown) => { subscribe(() => {}); return get(); } }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: async () => ({ data: { user: mocks.uid ? { id: mocks.uid } : null } }),
    onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({ upsert: mocks.upsert, select: async () => ({ data: [], error: null }) }),
}) }));

beforeEach(() => {
  vi.resetModules(); mocks.uid = null; mocks.upsert.mockReset().mockResolvedValue({ error: null });
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("account-only ratings and reviews", () => {
  it("rejects guest stars without changing device data or writing to the server", async () => {
    const { setRating } = await import("./ratings");
    expect(await setRating("place", 4)).toBe("auth-required");
    expect(localStorage.getItem("essenly.myrating")).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects guest review text and preserves a legacy record", async () => {
    const legacy = JSON.stringify({ place: { rating: 3, body: "old note" } });
    localStorage.setItem("essenly.myrating", legacy);
    const { setReview } = await import("./ratings");
    expect(await setReview("place", 5, "new note", true)).toBe("auth-required");
    expect(localStorage.getItem("essenly.myrating")).toBe(legacy);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("imports legacy guest public flags as private after login", async () => {
    mocks.uid = "account";
    localStorage.setItem("essenly.myrating", JSON.stringify({ place: { rating: 3, body: "old note", isPublic: true } }));
    const { useMyRatings } = await import("./ratings"); useMyRatings();
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalled());
    expect(mocks.upsert.mock.calls[0][0]).toEqual([{ user_id: "account", place_id: "place", rating: 3, body: "old note", is_public: false }]);
  });
  it("saves authenticated stars and text together and supports rating-only saves", async () => {
    mocks.uid = "account";
    const { useMyRatings, setReview } = await import("./ratings"); useMyRatings();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await setReview("place", 5, "Helpful staff", true)).toBe(true);
    expect(mocks.upsert.mock.lastCall?.[0]).toMatchObject({ rating: 5, body: "Helpful staff", is_public: true });
    expect(await setReview("place", 4, "", true)).toBe(true);
    expect(mocks.upsert.mock.lastCall?.[0]).toMatchObject({ rating: 4, body: null, is_public: false });
  });
  it("rejects a save after sign-out even when the composer was already open", async () => {
    mocks.uid = "account";
    const { useMyRatings, setReview } = await import("./ratings"); useMyRatings();
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.authChange?.("SIGNED_OUT", null);
    expect(await setReview("place", 5, "Unsaved text", true)).toBe("auth-required");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects invalid stars and reports a failed server save without keeping an optimistic review", async () => {
    mocks.uid = "account";
    const { useMyRatings, setReview } = await import("./ratings"); useMyRatings();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await setReview("place", 0, "text", true)).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.upsert.mockResolvedValue({ error: { message: "failed" } });
    expect(await setReview("place", 4, "text", true)).toBe(false);
    expect(JSON.parse(localStorage.getItem("essenly.myrating") ?? "{}")).toEqual({});
  });
});
