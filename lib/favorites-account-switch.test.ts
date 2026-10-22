import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Repro harness copied from lib/favorites-save.test.ts (per-user fake server,
// deferred requests, auth callback capture).
type Row = { user_id: string; kind: string; item_id: string };
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

async function loadStore() {
  const store = await import("./favorites");
  store.useFavoritesReady();
  await flush();
  return store;
}

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
});
afterEach(() => vi.unstubAllGlobals());


describe("fav-races-2: account switch (SIGNED_IN without SIGNED_OUT) must start the new account clean", () => {
  it("(a) user-2's failed save rolls back to user-2's state, not user-1's confirmed entry", async () => {
    const store = await loadStore(); // signed in as user-1
    expect(store.toggleFavorite("place", "p1")).toBe(true); // user-1 saves p1 (lands in user-1's session base)
    await flush();
    expect(has("p1", "user-1")).toBe(true);

    mocks.uid = "user-2";
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } }); // Switch account
    await flush();
    expect(store.useFavorites().place).toEqual([]); // mirror purged

    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce(() => slowUpsert.promise);
    expect(store.toggleFavorite("place", "p1")).toBe(true); // user-2 taps p1 during sync
    await flush();
    slowList.resolve({ data: [], error: null }); // user-2's snapshot lands
    await flush();
    slowUpsert.resolve({ error: { message: "offline" } }); // user-2's save fails
    await flush();
    expect(has("p1", "user-2")).toBe(false);
    expect(store.useFavorites().place).toEqual([]); // user-2 has no p1
  });

  it("(b) a toggle of user-1 that settled during an unfinished sync is not overlaid onto user-2's list", async () => {
    // user-1's initial snapshot is slow and never gets adopted
    const slowList1 = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList1.promise);
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false); // user-1 syncing
    expect(store.toggleFavorite("place", "a-item")).toBe(true); // user-1 saves during sync
    await flush();
    expect(has("a-item", "user-1")).toBe(true); // landed during user-1's sync (user-1's landedDuringSnapshot)

    // switch to user-2 before user-1's snapshot lands
    mocks.uid = "user-2";
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    await flush();
    slowList1.resolve({ data: [{ kind: "place", item_id: "a-item" }], error: null }); // user-1's late snapshot: its session has ended, ignored
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
    expect(has("a-item", "user-2")).toBe(false);
    expect(store.useFavorites().place).toEqual([]); // user-2's view
    const mirror = JSON.parse(storage.get("essenly.favorites") ?? "{\"place\":[]}");
    expect(mirror.place).toEqual([]); // user-2's mirror
  });
});
