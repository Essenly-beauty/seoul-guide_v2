import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// p2-races-3 / revive: a merge row the old flow put on the wire lands in the
// revived session after the new flow read its snapshot. dispatch() applies a
// landed write to `base` (and to landedDuringSnapshot); the merge row's
// completion does neither, so the revived session never shows a row the
// server now holds. Asserts the CORRECT behaviour; FAILS on the current code.

type Row = { user_id: string; kind: string; item_id: string };
const mocks = vi.hoisted(() => ({
  uid: null as string | null,
  server: [] as Row[],
  upsert: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("react", () => ({ useSyncExternalStore: (s: (cb: () => void) => unknown, g: () => unknown) => { s(() => {}); return g(); } }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: async () => ({ data: { user: mocks.uid ? { id: mocks.uid } : null }, error: null }),
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

let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  mocks.uid = "user-1"; mocks.server = []; mocks.authChange = null;
  mocks.upsert.mockReset().mockImplementation(async (rows: Row | Row[]) => apply(rows));
  mocks.del.mockReset().mockImplementation(async (m: Row) => { mocks.server = mocks.server.filter((r) => !(r.item_id === m.item_id && r.user_id === m.user_id)); return { error: null }; });
  mocks.list.mockReset().mockImplementation(async (scope: string) => ({ data: mocks.server.filter((r) => r.user_id === mocks.uid && r.user_id === scope).map(({ kind, item_id }) => ({ kind, item_id })), error: null }));
  storage = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  const ss = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => ss.get(k) ?? null, setItem: (k: string, v: string) => ss.set(k, v), removeItem: (k: string) => ss.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("races8: revive takes over the old flow's merge rows", () => {
  it("shows a legacy row that the old merge landed after the revived session's snapshot was read", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["legacy"], product: [], article: [] })); // untagged legacy guest list
    const slowMerge = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowMerge.promise.then((settled) => { apply(row); return settled; }));
    const store = await import("@/lib/favorites");
    store.useFavoritesReady();
    await flush(); // flow A: merge UPSERT for "legacy" on the wire
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    mocks.authChange?.("SIGNED_OUT", null); // ended with a request on the wire -> kept for revive
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } }); // straight back in (email form, no reload)
    await flush(); // flow B: no rows to merge (mirror wiped), snapshot read before the merge row committed
    expect(store.useFavoritesReady()).toBe(true);

    slowMerge.resolve({ error: null }); // the old merge row lands now
    await flush();
    expect(has("legacy")).toBe(true); // the server holds it
    expect(store.useFavorites().place).toEqual(["legacy"]); // current code: [] until the next page load
  });

  it("control: a write dispatched by toggle in the same position is applied (dispatch updates base)", async () => {
    const store = await import("@/lib/favorites");
    store.useFavoritesReady();
    await flush();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((settled) => { apply(row); return settled; }));
    store.toggleFavorite("place", "p1");
    await flush();
    mocks.authChange?.("SIGNED_OUT", null);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } });
    await flush();
    slowUpsert.resolve({ error: null });
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]);
  });
});
