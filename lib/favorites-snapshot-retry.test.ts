import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Contract lens, round 2. Harness copied from lib/favorites-save.test.ts.
// A member opens the app offline on a device with no (or an old) mirror: the
// three snapshot attempts fail, the store reports ready with known=false, and the
// Saved tab renders the mirror as the account's list ("Nothing saved yet" on a
// fresh device). When the connection returns, nothing ever fetches the snapshot
// again in this page: same-account auth events return early in startSession and
// there is no reconnect hook.

const mocks = vi.hoisted(() => ({
  uid: "user-1" as string | null,
  online: false,
  server: [{ user_id: "user-1", kind: "place", item_id: "p1" }] as { user_id: string; kind: string; item_id: string }[],
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  listCalls: 0,
}));

vi.mock("react", () => ({ useSyncExternalStore: (subscribe: (cb: () => void) => unknown, get: () => unknown) => { subscribe(() => {}); return get(); } }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    // offline: getUser cannot reach the server; INITIAL_SESSION replays the stored session
    getUser: () => Promise.resolve(mocks.online
      ? { data: { user: { id: mocks.uid } }, error: null }
      : { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" } }),
    onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: async () => {
      mocks.listCalls += 1;
      return mocks.online
        ? { data: mocks.server.filter((r) => r.user_id === mocks.uid).map(({ kind, item_id }) => ({ kind, item_id })), error: null }
        : { data: null, error: { message: "TypeError: Failed to fetch" } };
    } }) }),
    upsert: async () => (mocks.online ? { error: null } : { error: { message: "offline" } }),
    delete: () => ({ match: async () => (mocks.online ? { error: null } : { error: { message: "offline" } }) }),
  }),
}) }));

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

let storage: Map<string, string>;
const windowListeners = new Map<string, ((e: unknown) => void)[]>();
beforeEach(() => {
  vi.resetModules();
  mocks.online = false;
  mocks.authChange = null;
  mocks.listCalls = 0;
  storage = new Map<string, string>(); // fresh device: no mirror
  windowListeners.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: (e: unknown) => void) => { windowListeners.set(type, [...(windowListeners.get(type) ?? []), fn]); },
    removeEventListener() {},
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("p2-contract-3: snapshot retry after an offline start", () => {
  it("shows the account's list once the connection is back (reconnect / refocus / token refresh)", async () => {
    const store = await import("@/lib/favorites");
    store.useFavoritesReady();
    mocks.authChange?.("INITIAL_SESSION", { user: { id: "user-1" } });
    await new Promise((r) => setTimeout(r, 4600)); // 3 attempts with 0.7 s + 1.4 s + 2.1 s backoff
    await flush();
    expect(mocks.listCalls).toBe(3);
    expect(store.useFavoritesReady()).toBe(true); // the Saved tab now renders "Nothing saved yet"
    expect(store.useFavorites().place).toEqual([]);

    // Connection returns. The browser fires `online`; Supabase fires SIGNED_IN on tab
    // refocus and TOKEN_REFRESHED on its next refresh — all for the same account.
    mocks.online = true;
    windowListeners.get("online")?.forEach((fn) => fn({ type: "online" }));
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } });
    mocks.authChange?.("TOKEN_REFRESHED", { user: { id: "user-1" } });
    await flush();
    await new Promise((r) => setTimeout(r, 50));
    await flush();

    expect(store.useFavorites().place).toEqual(["p1"]);
  }, 15000);
});
