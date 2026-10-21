import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests lens: one test per invariant the current suite leaves unpinned (each
// names the mutant ids from tlmut-run.mjs it kills). All must PASS on the
// current lib/favorites.ts. Harness copied from lib/favorites-save.test.ts.

type Row = { user_id: string; kind: string; item_id: string };
type Snap = { data: { kind: string; item_id: string }[] | null; error: unknown };
const mocks = vi.hoisted(() => ({
  uid: null as string | null,
  server: [] as Row[],
  upsert: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));

vi.mock("react", () => ({ useSyncExternalStore: (subscribe: (cb: () => void) => unknown, get: () => unknown) => { subscribe(() => {}); return get(); } }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: async () => ({ data: { user: mocks.uid ? { id: mocks.uid } : null } }),
    onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: mocks.list }) }),
    upsert: mocks.upsert,
    delete: () => ({ match: mocks.del }),
  }),
}) }));

type Settled = { error: unknown };
function deferred<T = Settled>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const has = (id: string, uid = "user-1") => mocks.server.some((row) => row.item_id === id && row.user_id === uid);
const apply = (rows: Row | Row[]) => { for (const row of Array.isArray(rows) ? rows : [rows]) if (!has(row.item_id, row.user_id)) mocks.server.push(row); return { error: null }; };
const remove = (match: Row) => { mocks.server = mocks.server.filter((row) => !(row.item_id === match.item_id && row.user_id === match.user_id)); return { error: null }; };
async function settledWithin<T>(p: Promise<T>): Promise<T | "pending"> {
  let out: T | "pending" = "pending";
  void p.then((v) => { out = v; });
  await flush();
  return out;
}
async function loadStore() {
  const store = await import("./favorites");
  store.useFavoritesReady();
  await flush();
  return store;
}
const LIST = "essenly.favorites";
const OWNER = "essenly.favorites.owner";
const MERGED = "essenly.favorites.mergedFor";

let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  mocks.uid = "user-1";
  mocks.server = [];
  mocks.authChange = null;
  mocks.upsert.mockReset().mockImplementation(async (rows: Row | Row[]) => apply(rows));
  mocks.del.mockReset().mockImplementation(async (match: Row) => remove(match));
  mocks.list.mockReset().mockImplementation(async () => ({ data: mocks.server.filter((row) => row.user_id === mocks.uid).map(({ kind, item_id }) => ({ kind, item_id })), error: null }));
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("session end: queued intents", () => {
  it("PA1 [M02 M29 M30 M43]: a save queued in the same tick as sign-out resolves failed and never reaches the server", async () => {
    const store = await loadStore();
    const outcome = store.saveFavorite("place", "p1");
    store.purgeFavoritesMirror();
    expect(await settledWithin(outcome)).toBe("failed");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("PA2 [M02 M33]: a save queued in the same tick as an account switch resolves failed and is sent for neither account", async () => {
    const store = await loadStore();
    const outcome = store.saveFavorite("place", "p1");
    mocks.uid = "user-2";
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    expect(await settledWithin(outcome)).toBe("failed");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("reconcile only trusts a server snapshot", () => {
  it("PB [M03]: during the sync, an un-heart queued behind a failed save still goes out (the mirror is not the server)", async () => {
    storage.set(LIST, JSON.stringify({ place: [], product: [], article: [] }));
    storage.set(OWNER, "user-1");
    storage.set(MERGED, "user-1");
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }]; // saved on another device
    const slowList = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false);
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce(() => slowUpsert.promise);
    expect(store.toggleFavorite("place", "p1")).toBe(true);
    await flush();
    expect(store.toggleFavorite("place", "p1")).toBe(false); // changed their mind while the save is on the wire
    slowUpsert.resolve({ error: { message: "offline" } });
    await flush();
    slowList.resolve({ data: [{ kind: "place", item_id: "p1" }], error: null }); // read before the DELETE
    await flush();
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });
});

describe("waiters answer their own request", () => {
  it("PC [M13]: a save queued behind an in-flight DELETE is answered by its own UPSERT, not by the DELETE", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await loadStore();
    const slowDelete = deferred();
    mocks.del.mockImplementationOnce((m: Row) => slowDelete.promise.then((s) => { remove(m); return s; }));
    expect(store.toggleFavorite("place", "p1")).toBe(false);
    await flush();
    const outcome = store.saveFavorite("place", "p1");
    mocks.upsert.mockResolvedValueOnce({ error: { message: "offline" } });
    slowDelete.resolve({ error: null });
    expect(await settledWithin(outcome)).toBe("failed");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("PD [M57]: a save made after the member un-hearted an in-flight save is the latest intent: no DELETE follows", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((s) => { apply(row); return s; }));
    expect(store.toggleFavorite("place", "p1")).toBe(true);
    await flush();
    expect(store.toggleFavorite("place", "p1")).toBe(false);
    const outcome = store.saveFavorite("place", "p1");
    slowUpsert.resolve({ error: null });
    expect(await settledWithin(outcome)).toBe("saved");
    expect(mocks.del).not.toHaveBeenCalled();
    expect(has("p1")).toBe(true);
    expect(store.useFavorites().place).toEqual(["p1"]);
  });
});

describe("device mirror ownership (pre-owner-tag devices, guests)", () => {
  it("PE [M19]: a mirror written before owner tags existed, merged for another account, is never shown to this one", async () => {
    storage.set(LIST, JSON.stringify({ place: ["a-secret"], product: [], article: [] }));
    storage.set(MERGED, "user-2"); // HEAD-era mirror: merge flag but no owner tag
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "mine" }];
    const slowList = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual([]);
    expect(mocks.upsert).not.toHaveBeenCalled();
    slowList.resolve({ data: [{ kind: "place", item_id: "mine" }], error: null });
    await flush();
    expect(store.useFavorites().place).toEqual(["mine"]);
  });

  it.each([
    ["owner tag only", OWNER],
    ["merge flag only (pre-owner-tag mirror)", MERGED],
  ])("PF [M47 M48 M49]: a guest load purges a mirror an expired session left behind (%s)", async (_label, tag) => {
    mocks.uid = null;
    storage.set(LIST, JSON.stringify({ place: ["their-secret"], product: [], article: [] }));
    storage.set(tag, "user-9");
    const store = await loadStore();
    expect([storage.has(LIST), storage.has(OWNER), storage.has(MERGED)]).toEqual([false, false, false]);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("PQ [M64]: a guest sees nothing even with an untagged legacy list, which stays for the merge at sign-in", async () => {
    mocks.uid = null;
    storage.set(LIST, JSON.stringify({ place: ["legacy"], product: [], article: [] }));
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual([]);
    expect(storage.has(LIST)).toBe(true);
  });
});

describe("sign-out event vs guest settle", () => {
  it("PG [M51]: a SIGNED_OUT event (another tab, revoked token) wipes the mirror and the pending request, not just the button", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("./signup-return");
    const store = await loadStore();
    store.toggleFavorite("place", "p1");
    await flush();
    setPendingFavoriteReturn({ placeId: "p2", placeName: "Two" });
    mocks.authChange?.("SIGNED_OUT", null);
    expect([storage.has(LIST), storage.has(OWNER), storage.has(MERGED)]).toEqual([false, false, false]);
    expect(peekPendingFavoriteReturn()).toBeNull();
  });

  it("PH [M46]: a guest's pre-signup request survives the store settling as a guest (page reload before signing in)", async () => {
    mocks.uid = null;
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("./signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "One" });
    await loadStore();
    mocks.authChange?.("INITIAL_SESSION", null);
    expect(peekPendingFavoriteReturn()?.placeId).toBe("p1");
  });
});

describe("readiness", () => {
  it("PI [M41]: an abandoned account's late snapshot does not mark the next account ready", async () => {
    const slowList1 = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => slowList1.promise);
    const store = await loadStore();
    mocks.uid = "user-2";
    const slowList2 = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => slowList2.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    await flush();
    slowList1.resolve({ data: [], error: null });
    await flush();
    expect(store.useFavoritesReady()).toBe(false);
    slowList2.resolve({ data: [], error: null });
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
  });

  it("PJ [M69]: switching account shows loading until the new account's list lands", async () => {
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(true);
    mocks.uid = "user-2";
    const slowList = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    expect(store.useFavoritesReady()).toBe(false);
    slowList.resolve({ data: [], error: null });
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
  });

  it("PK [M70]: signing out mid-sync leaves the store ready (as a guest)", async () => {
    const slowList = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false);
    mocks.authChange?.("SIGNED_OUT", null);
    expect(store.useFavoritesReady()).toBe(true);
  });

  it("PL [M32]: same-account auth events (INITIAL_SESSION, TOKEN_REFRESHED) do not restart the session", async () => {
    const store = await loadStore();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    mocks.authChange?.("INITIAL_SESSION", { user: { id: "user-1" } });
    mocks.authChange?.("TOKEN_REFRESHED", { user: { id: "user-1" } });
    expect(store.useFavoritesReady()).toBe(true);
    await flush();
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});

describe("supabase-js failure shapes", () => {
  it("PM [M65 M66]: a request whose promise rejects counts as failed and does not wedge the item", async () => {
    const store = await loadStore();
    mocks.upsert.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await settledWithin(store.saveFavorite("place", "p1"))).toBe("failed");
    expect(store.useFavorites().place).toEqual([]);
    expect(await settledWithin(store.saveFavorite("place", "p1"))).toBe("saved");
  });

  it("PN [M67 M68]: a snapshot that errors once is retried, not adopted as an empty list", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    mocks.list.mockResolvedValueOnce({ data: null, error: { message: "503" } });
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false);
    await new Promise((r) => setTimeout(r, 750)); // first retry waits 700 ms
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
    expect(store.useFavorites().place).toEqual(["p1"]);
  });
});

describe("merge rows hand over to queued intents", () => {
  it("PO [M25]: a heart removed during a merge that then partly fails is still removed on the server", async () => {
    storage.set(LIST, JSON.stringify({ place: ["p1", "p2"], product: [], article: [] }));
    const slowMerge = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowMerge.promise.then((s) => { apply(row); return s; })); // p1
    mocks.upsert.mockResolvedValueOnce({ error: { message: "offline" } }); // p2: the merge fails
    const store = await loadStore();
    expect(store.toggleFavorite("place", "p1")).toBe(false);
    slowMerge.resolve({ error: null });
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(has("p1")).toBe(false);
  });
});

describe("useSyncExternalStore contract", () => {
  it("PP [M72]: getSnapshot returns the same object until something changes", async () => {
    const store = await loadStore();
    mocks.upsert.mockImplementationOnce(() => new Promise(() => {}));
    store.toggleFavorite("place", "p1"); // an unconfirmed intent is part of the view
    expect(store.useFavorites()).toBe(store.useFavorites());
  });
});
