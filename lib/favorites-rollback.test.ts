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

describe("fav-races-1: a write that landed counts as the server's state even when a newer toggle followed it", () => {
  it("lost save: unsave lands, re-save fails -> view must be unsaved like the server", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual(["p1"]);
    const slowDelete = deferred();
    const slowUpsert = deferred();
    mocks.del.mockImplementationOnce((match: Row) => slowDelete.promise.then((s) => { remove(match); return s; }));
    mocks.upsert.mockImplementationOnce(() => slowUpsert.promise);
    store.toggleFavorite("place", "p1"); // W1 DELETE in flight
    await flush();
    store.toggleFavorite("place", "p1"); // W2 UPSERT queued
    await flush();
    slowDelete.resolve({ error: null }); // W1 lands: server row gone
    await flush();
    slowUpsert.resolve({ error: { message: "offline" } }); // W2 fails
    await flush();
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("phantom save: save lands, unsave fails -> view must be saved like the server", async () => {
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual([]);
    const slowUpsert = deferred();
    const slowDelete = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((s) => { apply(row); return s; }));
    mocks.del.mockImplementationOnce(() => slowDelete.promise);
    store.toggleFavorite("place", "p1"); // W1 UPSERT in flight
    await flush();
    store.toggleFavorite("place", "p1"); // W2 DELETE queued
    await flush();
    slowUpsert.resolve({ error: null }); // W1 lands: server has row
    await flush();
    slowDelete.resolve({ error: { message: "offline" } }); // W2 fails
    await flush();
    expect(has("p1")).toBe(true);
    expect(store.useFavorites().place).toEqual(["p1"]);
  });
});
