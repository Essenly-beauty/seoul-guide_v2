import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests lens: every saveFavorite() promise must settle. Harness copied from
// lib/favorites-save.test.ts (per-user fake server, deferred requests, auth
// callback capture). Imports the REAL store via the "@" alias.

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
/** "pending" if the promise has not settled after a generous flush. */
async function settledWithin<T>(p: Promise<T>): Promise<T | "pending"> {
  let out: T | "pending" = "pending";
  void p.then((v) => { out = v; });
  await flush();
  await flush();
  return out;
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
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("tests lens: saveFavorite always settles", () => {
  it("W1: a save that joins the sign-in merge's UPSERT for the same item resolves when that UPSERT lands", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] })); // legacy guest list
    const slowMerge = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowMerge.promise.then((settled) => { apply(row); return settled; }));
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush(); // merge UPSERT for p1 is on the wire
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const outcome = store.saveFavorite("place", "p1"); // joins the in-flight UPSERT ("its answer is ours")
    slowMerge.resolve({ error: null });
    await flush();
    expect(has("p1")).toBe(true);
    expect(store.useFavoritesReady()).toBe(true);
    expect(await settledWithin(outcome)).toBe("saved"); // current code: still "pending"
  });

  it("W2: a save queued behind an in-flight DELETE settles even if the account signs out before the DELETE answers", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    const slowDelete = deferred();
    mocks.del.mockImplementationOnce((match: Row) => slowDelete.promise.then((settled) => { remove(match); return settled; }));
    expect(store.toggleFavorite("place", "p1")).toBe(false); // DELETE on the wire
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1);
    const outcome = store.saveFavorite("place", "p1"); // queued behind the DELETE
    store.purgeFavoritesMirror(); // sign-out: queued intents never go out
    slowDelete.resolve({ error: null });
    await flush();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(await settledWithin(outcome)).toBe("failed"); // current code: still "pending"
  });

  it("W3 (control): a queued save at sign-out resolves failed and never goes out", async () => {
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    const outcome = store.saveFavorite("place", "p1"); // queued for the microtask
    store.purgeFavoritesMirror(); // same tick
    expect(await settledWithin(outcome)).toBe("failed");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
