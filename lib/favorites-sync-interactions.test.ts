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

describe("interactions: a superseded write lands DURING the account sync", () => {
  it("unsave lands after the snapshot was read, the re-save is still in flight when the snapshot lands, then fails -> view = server (unsaved)", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] }));
    storage.set("essenly.favorites.mergedFor", "user-1");
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(false);
    expect(store.useFavorites().place).toEqual(["p1"]);
    const slowDelete = deferred();
    mocks.del.mockImplementationOnce((match: Row) => slowDelete.promise.then((settled) => { remove(match); return settled; }));
    expect(store.toggleFavorite("place", "p1")).toBe(false); // W1 DELETE in flight
    await flush();
    expect(store.toggleFavorite("place", "p1")).toBe(true); // W2 UPSERT queued behind it
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce(() => slowUpsert.promise);
    slowDelete.resolve({ error: null }); // W1 lands (superseded)
    await flush();
    expect(has("p1")).toBe(false);
    slowList.resolve({ data: [{ kind: "place", item_id: "p1" }], error: null }); // snapshot read BEFORE W1 landed
    await flush();
    slowUpsert.resolve({ error: { message: "offline" } }); // W2 fails after the snapshot landed
    await flush();
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });
  it("same, but W2 fails BEFORE the snapshot lands -> the snapshot must not resurrect the stale row", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] }));
    storage.set("essenly.favorites.mergedFor", "user-1");
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await loadStore();
    const slowDelete = deferred();
    mocks.del.mockImplementationOnce((match: Row) => slowDelete.promise.then((settled) => { remove(match); return settled; }));
    store.toggleFavorite("place", "p1"); // W1 DELETE
    await flush();
    store.toggleFavorite("place", "p1"); // W2 UPSERT
    mocks.upsert.mockResolvedValueOnce({ error: { message: "offline" } });
    slowDelete.resolve({ error: null }); // W1 lands, W2 sent and fails
    await flush();
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
    slowList.resolve({ data: [{ kind: "place", item_id: "p1" }], error: null }); // stale snapshot (read before W1)
    await flush();
    expect(store.useFavorites().place).toEqual([]); // W1 landed during the snapshot request and is overlaid onto it
  });
});
