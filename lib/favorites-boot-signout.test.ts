import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// p2-races-1 / sawAuthEvent: auth-js 2.112 queues the SIGNED_OUT that
// _recoverAndRefresh emits when a stored session's refresh token is dead
// (global sign-out elsewhere, expiry) and flushes it as soon as
// initializePromise settles — before getUser() (which awaits the same promise
// and then reads storage) can answer. The store has no session yet, so the
// event is treated as "not signed out here", and the getUser answer that
// would sweep the stale mirror is dropped by the sawAuthEvent guard.
// Asserts the CORRECT behaviour (the revoked account's mirror is purged, the
// guest's own pending request is kept); FAILS on the current code.

type Row = { user_id: string; kind: string; item_id: string };
const mocks = vi.hoisted(() => ({
  getUser: null as null | (() => Promise<unknown>),
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  upsert: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
}));

vi.mock("react", () => ({ useSyncExternalStore: (s: (cb: () => void) => unknown, g: () => unknown) => { s(() => {}); return g(); } }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: () => mocks.getUser!(),
    onAuthStateChange: (cb: typeof mocks.authChange) => { mocks.authChange = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: mocks.list }) }),
    upsert: mocks.upsert,
    delete: () => ({ match: mocks.del }),
  }),
}) }));

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

const LIST = "essenly.favorites";
const OWNER = "essenly.favorites.owner";
const PENDING = "myseouldrop.signup-return.favorite";
const missing = { name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" };

let storage: Map<string, string>;
let pending: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  mocks.authChange = null;
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  mocks.del.mockReset().mockResolvedValue({ error: null });
  mocks.list.mockReset().mockResolvedValue({ data: [], error: null });
  storage = new Map();
  pending = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => pending.get(k) ?? null, setItem: (k: string, v: string) => pending.set(k, v), removeItem: (k: string) => pending.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("p2-races-1: a session found revoked at boot", () => {
  it("purges the revoked account's device mirror when SIGNED_OUT reaches the store before getUser answers", async () => {
    // user-9 used this shared device, then signed out everywhere from their phone.
    storage.set(LIST, JSON.stringify({ place: ["their-secret"], product: [], article: [] }));
    storage.set(OWNER, "user-9");
    // The current visitor's own pre-signup heart (must survive: no session ended here).
    pending.set(PENDING, JSON.stringify({ placeId: "p1", placeName: "P1", requestId: "r1" }));
    const lookup = deferred<unknown>();
    mocks.getUser = () => lookup.promise; // awaits initializePromise, then reads storage
    const store = await import("@/lib/favorites");
    store.useFavoritesReady(); // wires auth
    // initialize(): refresh fails (refresh_token_not_found) -> _removeSession -> SIGNED_OUT queued, flushed first
    mocks.authChange?.("SIGNED_OUT", null);
    lookup.resolve({ data: { user: null }, error: missing }); // the stored session is gone now
    mocks.authChange?.("INITIAL_SESSION", null);
    await flush();
    expect(store.useFavorites().place).toEqual([]);
    expect(pending.has(PENDING)).toBe(true);
    expect({ list: storage.has(LIST), owner: storage.has(OWNER) }).toEqual({ list: false, owner: false });
  });

  it("so the next page load (a new member returning from Google) paints the revoked account's hearts until its SIGNED_IN lands", async () => {
    storage.set(LIST, JSON.stringify({ place: ["their-secret"], product: [], article: [] }));
    storage.set(OWNER, "user-9");
    const lookup = deferred<unknown>();
    mocks.getUser = () => lookup.promise;
    let store = await import("@/lib/favorites");
    store.useFavoritesReady();
    mocks.authChange?.("SIGNED_OUT", null); // page 1: revoked session discovered at boot
    lookup.resolve({ data: { user: null }, error: missing });
    await flush();
    // page 2: the visitor joined with Google; full reload, user-2's cookie, init not settled yet
    vi.resetModules();
    mocks.authChange = null;
    mocks.getUser = () => new Promise(() => {});
    store = await import("@/lib/favorites");
    store.useFavoritesReady();
    expect(store.useFavorites().place).toEqual([]); // current code: ["their-secret"] (user-9's list on user-2's screen)
  });

  it("control: the same boot without the init-time SIGNED_OUT (no stored session at all) does purge", async () => {
    storage.set(LIST, JSON.stringify({ place: ["their-secret"], product: [], article: [] }));
    storage.set(OWNER, "user-9");
    mocks.getUser = () => Promise.resolve({ data: { user: null }, error: missing });
    const store = await import("@/lib/favorites");
    store.useFavoritesReady();
    mocks.authChange?.("INITIAL_SESSION", null);
    await flush();
    expect({ list: storage.has(LIST), owner: storage.has(OWNER) }).toEqual({ list: false, owner: false });
  });
});
