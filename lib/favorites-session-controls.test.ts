import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// races8: interleavings expected to be CLEAN on the current code (all should pass).

type Row = { user_id: string; kind: string; item_id: string };
type Snap = { data: { kind: string; item_id: string }[] | null; error: unknown };
const mocks = vi.hoisted(() => ({
  uid: null as string | null,
  server: [] as Row[],
  upsert: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
  getUser: null as null | (() => Promise<unknown>),
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("react", () => ({ useSyncExternalStore: (s: (cb: () => void) => unknown, g: () => unknown) => { s(() => {}); return g(); } }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: () => (mocks.getUser ? mocks.getUser() : Promise.resolve({ data: { user: mocks.uid ? { id: mocks.uid } : null }, error: null })),
    onAuthStateChange: (cb: typeof mocks.authChange) => { mocks.authChange = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: (_c: string, v: string) => ({ order: () => mocks.list(v) }) }),
    upsert: mocks.upsert,
    delete: () => ({ match: mocks.del }),
  }),
}) }));
function deferred<T = { error: unknown }>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const has = (id: string, uid = "user-1") => mocks.server.some((r) => r.item_id === id && r.user_id === uid);
const apply = (rows: Row | Row[]) => { for (const r of Array.isArray(rows) ? rows : [rows]) if (!has(r.item_id, r.user_id)) mocks.server.push(r); return { error: null }; };
const remove = (m: Row) => { mocks.server = mocks.server.filter((r) => !(r.item_id === m.item_id && r.user_id === m.user_id)); return { error: null }; };
const snapOf = (uid: string): Snap => ({ data: mocks.server.filter((r) => r.user_id === uid).map(({ kind, item_id }) => ({ kind, item_id })), error: null });
async function settledWithin<T>(p: Promise<T>): Promise<T | "pending"> { let out: T | "pending" = "pending"; void p.then((v) => { out = v; }); await flush(); await flush(); return out; }
async function loadStore() { const s = await import("@/lib/favorites"); s.useFavoritesReady(); await flush(); return s; }

let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  mocks.uid = "user-1"; mocks.server = []; mocks.authChange = null; mocks.getUser = null;
  mocks.upsert.mockReset().mockImplementation(async (rows: Row | Row[]) => apply(rows));
  mocks.del.mockReset().mockImplementation(async (m: Row) => remove(m));
  mocks.list.mockReset().mockImplementation(async (scope: string) => snapOf(scope));
  storage = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  const ss = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => ss.get(k) ?? null, setItem: (k: string, v: string) => ss.set(k, v), removeItem: (k: string) => ss.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("races8 clean: revive + start token", () => {
  it("C1: old flow's late snapshot (read before a DELETE) is discarded after revive; the revived flow's snapshot wins and readiness follows it", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "gone" }];
    const snapA = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => snapA.promise);
    const store = await loadStore(); // flow A waiting on its snapshot
    const slowDel = deferred();
    mocks.del.mockImplementationOnce((m: Row) => slowDel.promise.then((s) => { remove(m); return s; }));
    // the mirror is empty, so make the member delete via a saved->unsaved toggle: first save then unsave is noisy; instead
    // put a DELETE on the wire through toggle on a row the view shows after B's snapshot below.
    mocks.authChange?.("SIGNED_OUT", null);
    const snapB = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => snapB.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } }); // fresh session (nothing on the wire)
    await flush();
    expect(store.useFavoritesReady()).toBe(false);
    snapA.resolve({ data: [{ kind: "place", item_id: "stale-from-A" }], error: null });
    await flush();
    expect(store.useFavoritesReady()).toBe(false); // A cannot finish B's sync
    expect(store.useFavorites().place).toEqual([]);
    snapB.resolve(snapOf("user-1"));
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
    expect(store.useFavorites().place).toEqual(["gone"]);
    void slowDel;
  });

  it("C2: revive with a joined waiter: the old UPSERT lands in the revived session and answers saved", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((s) => { apply(row); return s; }));
    const outcome = store.saveFavorite("place", "p1");
    await flush();
    mocks.authChange?.("SIGNED_OUT", null);
    expect(await settledWithin(outcome)).toBe("pending"); // an UPSERT on the wire answers its own caller
    const snapB = deferred<Snap>();
    mocks.list.mockImplementationOnce(() => snapB.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } });
    await flush();
    slowUpsert.resolve({ error: null }); // lands during B's snapshot
    expect(await settledWithin(outcome)).toBe("saved");
    snapB.resolve({ data: [], error: null }); // read before the UPSERT committed
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]); // landedDuringSnapshot overlay
  });

  it("C3: a new toggle in the revived session queues behind the old in-flight UPSERT (never two on the wire)", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((s) => { apply(row); return s; }));
    store.toggleFavorite("place", "p1");
    await flush();
    mocks.authChange?.("SIGNED_OUT", null);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } });
    await flush(); // B's snapshot (read before the commit) shows nothing
    expect(store.useFavorites().place).toEqual([]);
    expect(store.toggleFavorite("place", "p1")).toBe(true); // re-heart in the revived session
    await flush();
    expect(mocks.upsert).toHaveBeenCalledTimes(1); // queued behind the old one
    slowUpsert.resolve({ error: null });
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]);
    expect(has("p1")).toBe(true);
  });

  it("C4: sign out -> user-2 -> back to user-1 with user-1's UPSERT still on the wire: user-2 never sees it, user-1 does", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((s) => { apply(row); return s; }));
    store.toggleFavorite("place", "p1");
    await flush();
    mocks.authChange?.("SIGNED_OUT", null);
    mocks.uid = "user-2";
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    await flush();
    expect(store.useFavorites().place).toEqual([]);
    mocks.uid = "user-1";
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } });
    await flush();
    slowUpsert.resolve({ error: null });
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]);
    expect(has("p1", "user-2")).toBe(false);
  });

  it("C5: INITIAL_SESSION replay after a real SIGNED_OUT never restores the account", async () => {
    const store = await loadStore();
    mocks.authChange?.("SIGNED_OUT", null);
    mocks.authChange?.("INITIAL_SESSION", { user: { id: "user-1" } });
    await flush();
    expect(store.canSaveFavorites()).toBe(false);
  });

  it("C6: offline boot (INITIAL_SESSION null, getUser retryable) keeps the mirror, and TOKEN_REFRESHED later restores it", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["mine"], product: [], article: [] }));
    storage.set("essenly.favorites.owner", "user-1");
    storage.set("essenly.favorites.mergedFor", "user-1");
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "mine" }];
    mocks.getUser = () => Promise.resolve({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } });
    const store = await import("@/lib/favorites");
    store.useFavoritesReady();
    mocks.authChange?.("INITIAL_SESSION", null); // __loadSession: expired + refresh offline
    await flush();
    expect(store.useFavorites().place).toEqual([]); // guest view while offline
    expect(storage.get("essenly.favorites.owner")).toBe("user-1"); // device copy kept
    mocks.authChange?.("TOKEN_REFRESHED", { user: { id: "user-1" } });
    await flush();
    expect(store.useFavorites().place).toEqual(["mine"]);
    expect(store.useFavoritesReady()).toBe(true);
  });

  it("C7: a save queued behind the old DELETE at sign-out resolves failed once and the revived session sends nothing for it", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await loadStore();
    const slowDel = deferred();
    mocks.del.mockImplementationOnce((m: Row) => slowDel.promise.then((s) => { remove(m); return s; }));
    store.toggleFavorite("place", "p1");
    await flush();
    const outcome = store.saveFavorite("place", "p1");
    mocks.authChange?.("SIGNED_OUT", null);
    expect(await settledWithin(outcome)).toBe("failed");
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } });
    await flush();
    slowDel.resolve({ error: null });
    await flush();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(store.useFavorites().place).toEqual([]);
  });
});
