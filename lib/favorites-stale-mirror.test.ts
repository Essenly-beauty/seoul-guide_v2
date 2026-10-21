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

describe("fav-races-4: a failed write during the sync falls back to the account snapshot, not to the stale device mirror", () => {
  it("failed save during sync rolls back to the account state (p1 saved on server), not to the stale mirror", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: [], product: [], article: [] }));
    storage.set("essenly.favorites.mergedFor", "user-1");
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false); // syncing
    expect(store.useFavorites().place).toEqual([]); // stale mirror
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce(() => slowUpsert.promise);
    expect(store.toggleFavorite("place", "p1")).toBe(true);
    await flush();
    slowList.resolve({ data: [{ kind: "place", item_id: "p1" }], error: null });
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]);
    slowUpsert.resolve({ error: { message: "offline" } });
    await flush();
    expect(has("p1")).toBe(true); // account has p1
    expect(store.useFavorites().place).toEqual(["p1"]); // heart must stay on
  });

  it("failed unsave during sync rolls back to the account state (p1 NOT on server), not to the stale mirror", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] }));
    storage.set("essenly.favorites.mergedFor", "user-1");
    mocks.server = [];
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false);
    expect(store.useFavorites().place).toEqual(["p1"]); // stale mirror
    const slowDelete = deferred();
    mocks.del.mockImplementationOnce(() => slowDelete.promise);
    expect(store.toggleFavorite("place", "p1")).toBe(false);
    await flush();
    slowList.resolve({ data: [], error: null });
    await flush();
    slowDelete.resolve({ error: { message: "offline" } });
    await flush();
    expect(has("p1")).toBe(false); // account does not have p1
    expect(store.useFavorites().place).toEqual([]); // heart must stay off
  });
});
