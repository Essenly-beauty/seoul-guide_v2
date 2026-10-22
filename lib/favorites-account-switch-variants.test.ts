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
describe("account switch without SIGNED_OUT — other variants", () => {
  it("second tab: when the other tab already claimed MERGED_KEY for user-2, this tab must not show or persist user-1's list for user-2", async () => {
    mocks.server = [
      { user_id: "user-1", kind: "place", item_id: "a-secret" },
      { user_id: "user-2", kind: "place", item_id: "b-own" },
    ];
    const store = await loadStore(); // this tab: user-1
    expect(store.useFavorites().place).toEqual(["a-secret"]);
    // the OTHER tab ran Settings > Switch account: its merge purged user-1's mirror and claimed the device for user-2
    storage.delete("essenly.favorites");
    storage.set("essenly.favorites.mergedFor", "user-2");
    mocks.uid = "user-2";
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } }); // cross-tab broadcast reaches this tab
    await flush();
    const duringSync = store.useFavorites().place;
    store.toggleFavorite("place", "b-new"); // user-2 hearts something while their list loads
    const mirror = JSON.parse(storage.get("essenly.favorites") ?? "{}").place;
    slowList.resolve({ data: [{ kind: "place", item_id: "b-own" }], error: null });
    await flush();
    expect({ duringSync, mirror }).toEqual({ duringSync: [], mirror: ["b-new"] });
  });

  it("a write that landed during user-1's abandoned sync is never overlaid onto user-2's snapshot", async () => {
    const slowList1 = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList1.promise); // user-1's snapshot hangs
    const store = await loadStore();
    expect(store.toggleFavorite("place", "a-item")).toBe(true); // lands while user-1's sync is open
    await flush();
    expect(has("a-item", "user-1")).toBe(true);
    mocks.uid = "user-2";
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } }); // direct switch
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
    expect(has("a-item", "user-2")).toBe(false);
    expect(store.useFavorites().place).toEqual([]); // user-2 has nothing
    expect(JSON.parse(storage.get("essenly.favorites") ?? "{}").place).toEqual([]);
  });
});
