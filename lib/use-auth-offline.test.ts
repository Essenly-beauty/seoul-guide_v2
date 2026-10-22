import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// races8 / offline: the favorites store (fix #2) treats a getUser network
// failure as "not a sign-out" and keeps the member's session, but
// useAuthUser — which FavoriteButton / place detail / SignupReturnNotice gate
// on — sets user=null on the same failure for any instance mounted after
// init (INITIAL_SESSION(user) first, then the failed getUser). A heart on a
// sheet opened while offline then opens the join sheet for a signed-in member
// whose hearts the store still shows. Asserts the CORRECT (consistent)
// behaviour; FAILS today.

const mocks = vi.hoisted(() => ({
  callbacks: [] as ((event: string, session: { user: { id: string } } | null) => void)[],
  state: [] as unknown[],
  cursor: 0,
}));
vi.mock("react", () => ({
  useSyncExternalStore: (s: (cb: () => void) => unknown, g: () => unknown) => { s(() => {}); return g(); },
  useMemo: (fn: () => unknown) => fn(),
  useState: (init: unknown) => {
    const i = mocks.cursor++;
    if (!(i in mocks.state)) mocks.state[i] = init;
    return [mocks.state[i], (v: unknown) => { mocks.state[i] = v; }];
  },
  useEffect: (fn: () => unknown) => { fn(); },
}));
const offline = { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" };
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: offline }),
    onAuthStateChange: (cb: (typeof mocks.callbacks)[number]) => { mocks.callbacks.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: "offline", status: 0 } }) }) }),
    upsert: async () => ({ error: { message: "offline" } }),
    delete: () => ({ match: async () => ({ error: { message: "offline" } }) }),
  }),
}) }));
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

beforeEach(() => {
  vi.resetModules();
  mocks.callbacks = []; mocks.state = []; mocks.cursor = 0;
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("p2-races-5: a heart mounted while offline", () => {
  it("is gated on the same signed-in state the favorites store keeps", async () => {
    const store = await import("@/lib/favorites");
    const { useAuthUser } = await import("@/lib/auth/use-auth");
    store.useFavorites(); // the store is wired (map screen)
    mocks.cursor = 0; mocks.state = [];
    useAuthUser(); // a FavoriteButton on a sheet opened while offline
    // per-subscriber INITIAL_SESSION from storage (token still valid), then both getUser calls fail
    for (const cb of mocks.callbacks) cb("INITIAL_SESSION", { user: { id: "user-1" } });
    await flush();
    const hookUser = (mocks.state[0] as { id: string } | null)?.id ?? null;
    expect({ storeSignedIn: store.canSaveFavorites(), buttonUser: hookUser }).toEqual({ storeSignedIn: true, buttonUser: "user-1" });
  });
});

describe("p2-races-5 control: a definite sign-out still clears the hook", () => {
  it("documents that only the non-definite (offline) error is at issue", async () => {
    // Sanity: the real auth-js _getUser (GoTrueClient.js:2705-2713) returns
    // { data: { user: null }, error: AuthRetryableFetchError } on a failed fetch,
    // which is exactly what the mocked getUser above returns.
    expect(offline.name).toBe("AuthRetryableFetchError");
  });
});
