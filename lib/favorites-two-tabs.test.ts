import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Two tabs = two module instances of lib/favorites sharing one localStorage
// and one (cookie-shared) session. auth-js order in the tab that signs in:
// broadcastChannel.postMessage(...) THEN local callbacks (synchronously);
// the other tab's broadcast handler runs later, in its own task.
type Row = { user_id: string; kind: string; item_id: string };
type AuthCb = (event: string, session: { user: { id: string } } | null) => void;
const mocks = vi.hoisted(() => ({
  uid: null as string | null,
  server: [] as Row[],
  list: null as unknown as (...a: unknown[]) => unknown,
  callbacks: [] as AuthCb[],
}));

vi.mock("react", () => ({ useSyncExternalStore: (s: (cb: () => void) => unknown, g: () => unknown) => { s(() => {}); return g(); } }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: async () => ({ data: { user: mocks.uid ? { id: mocks.uid } : null } }),
    onAuthStateChange: (cb: AuthCb) => { mocks.callbacks.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: (...a: unknown[]) => mocks.list(...a) }) }),
    upsert: async (rows: Row | Row[]) => { for (const r of Array.isArray(rows) ? rows : [rows]) if (!mocks.server.some((x) => x.user_id === r.user_id && x.item_id === r.item_id)) mocks.server.push(r); return { error: null }; },
    delete: () => ({ match: async (m: Row) => { mocks.server = mocks.server.filter((x) => !(x.user_id === m.user_id && x.item_id === m.item_id)); return { error: null }; } }),
  }),
}) }));

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const snapshot = () => ({ data: mocks.server.filter((r) => r.user_id === mocks.uid).map(({ kind, item_id }) => ({ kind, item_id })), error: null });

let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  mocks.uid = "user-1";
  mocks.callbacks = [];
  mocks.server = [
    { user_id: "user-1", kind: "place", item_id: "a-secret" },
    { user_id: "user-2", kind: "place", item_id: "b-own" },
  ];
  mocks.list = async () => snapshot();
  storage = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("fav-races-3: Switch account in tab 2 while tab 1 is open", () => {
  it("tab 1 never shows or persists user-1's hearts for user-2", async () => {
    const tab1 = await import("./favorites");
    tab1.useFavoritesReady(); await flush();
    const tab1Cb = mocks.callbacks[0];
    vi.resetModules();
    const tab2 = await import("./favorites");
    tab2.useFavoritesReady(); await flush();
    const tab2Cb = mocks.callbacks[1];
    expect(tab1.useFavorites().place).toEqual(["a-secret"]);
    expect(tab2.useFavorites().place).toEqual(["a-secret"]);
    expect(storage.get("essenly.favorites.mergedFor")).toBe("user-1");

    // Tab 2: Settings > Switch account > signInWithPassword(user-2) => SIGNED_IN.
    mocks.uid = "user-2";
    let releaseList!: () => void;
    const gate = new Promise<void>((r) => { releaseList = r; });
    mocks.list = async () => { await gate; return snapshot(); }; // user-2's snapshot is slow to load
    tab2Cb("SIGNED_IN", { user: { id: "user-2" } }); // local callback, synchronous after postMessage
    const mergedForAfterTab2 = storage.get("essenly.favorites.mergedFor");
    await new Promise((r) => setTimeout(r, 0)); // broadcast is delivered in a later task
    tab1Cb("SIGNED_IN", { user: { id: "user-2" } }); // tab 1 receives the broadcast
    await flush();

    const tab1DuringSync = [...tab1.useFavorites().place];
    tab1.toggleFavorite("place", "b-new"); // user-2 hearts something in tab 1 while their list loads
    await flush();
    const mirrorAfterTap = JSON.parse(storage.get("essenly.favorites") ?? "{}").place;
    releaseList();
    await flush();

    expect({ mergedForAfterTab2, tab1DuringSync, mirrorAfterTap }).toEqual({
      mergedForAfterTab2: "user-2",
      tab1DuringSync: [],
      mirrorAfterTap: ["b-new"],
    });
  });
});
