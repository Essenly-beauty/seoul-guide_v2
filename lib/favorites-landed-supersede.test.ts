import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A request that was SENT and SUCCEEDED while a newer toggle was already made
// still updates what the server is known to hold (the session's base); when the
// newer write then fails, the heart shows that state — never one the server no
// longer has (review 2026-10-21, fav-flow-1).

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

describe("rollback after a superseded-but-landed write", () => {
  it("save lands, the quick un-save fails: the heart must match the server (saved)", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((settled) => { apply(row); return settled; }));
    expect(store.toggleFavorite("place", "p1")).toBe(true); // UPSERT in flight
    await flush();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    mocks.del.mockResolvedValueOnce({ error: { message: "offline" } });
    expect(store.toggleFavorite("place", "p1")).toBe(false); // DELETE queued behind it
    slowUpsert.resolve({ error: null }); // the UPSERT landed: the server has p1
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1); // the DELETE was sent and failed
    expect(has("p1")).toBe(true);
    expect(store.useFavorites().place).toEqual(["p1"]); // view should equal server
  });

  it("un-save lands, the quick re-save fails: the heart must not claim a save the server does not have", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual(["p1"]);
    const slowDelete = deferred();
    mocks.del.mockImplementationOnce((match: Row) => slowDelete.promise.then((settled) => { remove(match); return settled; }));
    expect(store.toggleFavorite("place", "p1")).toBe(false); // DELETE in flight
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1);
    mocks.upsert.mockResolvedValueOnce({ error: { message: "offline" } });
    expect(store.toggleFavorite("place", "p1")).toBe(true); // UPSERT queued behind it
    slowDelete.resolve({ error: null }); // the DELETE landed: the server no longer has p1
    await flush();
    expect(mocks.upsert).toHaveBeenCalledTimes(1); // the UPSERT was sent and failed
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]); // view should equal server
  });
});
