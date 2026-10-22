import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// saveFavorite honours a guest's pre-signup heart once they return signed in.
// It must report what the server did: the caller keeps the request for a retry
// on "failed" and drops it on "superseded" (codex review 2026-10-20). The fake
// server below keeps per-account state and applies writes in the order it
// receives them, so request ORDER and account mixing are observable.

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

async function loadStore() {
  const store = await import("./favorites");
  store.useFavoritesReady(); // subscribing wires auth and adopts the account's list
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
  mocks.del.mockReset().mockImplementation(async (match: Row) => { mocks.server = mocks.server.filter((row) => !(row.item_id === match.item_id && row.user_id === match.user_id)); return { error: null }; });
  mocks.list.mockReset().mockImplementation(async () => ({ data: mocks.server.filter((row) => row.user_id === mocks.uid).map(({ kind, item_id }) => ({ kind, item_id })), error: null }));
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("pre-signup request lifetime (fav-flow-2 / fav-flow-3)", () => {
  it("sign-out drops a request this tab still holds, so the next account never inherits it", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("./signup-return");
    const store = await loadStore();
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    store.purgeFavoritesMirror();
    expect(peekPendingFavoriteReturn()).toBeNull();
  });
  it("a member's own toggle of the place retires the request for it, and only for it", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("./signup-return");
    const store = await loadStore();
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    store.toggleFavorite("place", "other");
    expect(peekPendingFavoriteReturn()?.placeId).toBe("p1");
    store.toggleFavorite("place", "p1");
    expect(peekPendingFavoriteReturn()).toBeNull();
  });
});
