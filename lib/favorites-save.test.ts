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
  /** user_id the snapshot query filtered on (the fake applies it on top of RLS, i.e. the token's user). */
  scopedTo: null as string | null,
  getUser: null as null | (() => Promise<unknown>),
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));

vi.mock("react", () => ({ useSyncExternalStore: (subscribe: (cb: () => void) => unknown, get: () => unknown) => { subscribe(() => {}); return get(); } }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: () => (mocks.getUser ? mocks.getUser() : Promise.resolve({ data: { user: mocks.uid ? { id: mocks.uid } : null }, error: null })),
    onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: (column: string, value: string) => { if (column === "user_id") mocks.scopedTo = value; return { order: mocks.list }; } }),
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
  mocks.scopedTo = null;
  mocks.getUser = null;
  mocks.upsert.mockReset().mockImplementation(async (rows: Row | Row[]) => apply(rows));
  mocks.del.mockReset().mockImplementation(async (match: Row) => { mocks.server = mocks.server.filter((row) => !(row.item_id === match.item_id && row.user_id === match.user_id)); return { error: null }; });
  // RLS returns the token user's rows; the query's own user_id filter narrows that further.
  mocks.list.mockReset().mockImplementation(async () => ({ data: mocks.server.filter((row) => row.user_id === mocks.uid && (mocks.scopedTo === null || row.user_id === mocks.scopedTo)).map(({ kind, item_id }) => ({ kind, item_id })), error: null }));
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("saveFavorite", () => {
  it("resolves saved once the server accepted the row", async () => {
    const store = await loadStore();
    expect(store.useFavoritesReady()).toBe(true);
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("saved");
    expect(store.useFavorites().place).toEqual(["p1"]);
    expect(has("p1")).toBe(true);
  });

  it("resolves failed, rolls the heart back, and lets the next attempt reach the server again", async () => {
    const store = await loadStore();
    mocks.upsert.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("failed");
    expect(store.useFavorites().place).toEqual([]);
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("saved");
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(has("p1")).toBe(true);
  });

  it("answers saved without a request once the account snapshot shows the row", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual(["p1"]);
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("saved");
    expect(mocks.upsert).not.toHaveBeenCalled(); // the snapshot is the server's own answer
  });

  it("confirms a row the device mirror shows before the snapshot lands: mirror rows may never have reached the server", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] }));
    storage.set("essenly.favorites.owner", "user-1");
    storage.set("essenly.favorites.mergedFor", "user-1");
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]); // mirror, not yet confirmed
    mocks.upsert.mockResolvedValueOnce({ error: { message: "down" } });
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("failed"); // could not confirm it
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("saved");
    expect(has("p1")).toBe(true);
    slowList.resolve({ data: [{ kind: "place", item_id: "p1" }], error: null });
    await flush();
    expect(store.useFavorites().place).toEqual(["p1"]);
  });

  it("scopes the account snapshot to the session's own account", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "mine" }];
    const store = await loadStore();
    expect(mocks.scopedTo).toBe("user-1");
    expect(store.useFavorites().place).toEqual(["mine"]);
  });

  it("ignores a late getUser answer once a newer sign-in arrived: the tab stays on the new account and never adopts its rows under the old one", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "a-row" }, { user_id: "user-2", kind: "place", item_id: "b-row" }];
    const lateGetUser = deferred<unknown>();
    mocks.getUser = () => lateGetUser.promise; // the page-load lookup hangs on a bad network
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    mocks.uid = "user-2"; // Settings > Switch account: the token now belongs to user-2
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    await flush();
    expect(store.useFavorites().place).toEqual(["b-row"]);
    lateGetUser.resolve({ data: { user: { id: "user-1" } }, error: null }); // stale answer for the old account
    await flush();
    expect(store.useFavorites().place).toEqual(["b-row"]);
    expect(storage.get("essenly.favorites.owner")).toBe("user-2");
    store.toggleFavorite("place", "p9");
    await flush();
    expect(has("p9", "user-2")).toBe(true);
    expect(has("p9", "user-1")).toBe(false);
  });

  it("does not treat an offline page load as a sign-out: the device copy and the pending pre-signup request survive", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["unsynced"], product: [], article: [] }));
    storage.set("essenly.favorites.owner", "user-1");
    const pending = new Map<string, string>([["myseouldrop.signup-return.favorite", JSON.stringify({ placeId: "p1", placeName: "P1", requestId: "r1" })]]);
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => pending.get(k) ?? null, setItem: (k: string, v: string) => pending.set(k, v), removeItem: (k: string) => pending.delete(k) });
    mocks.getUser = () => Promise.resolve({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" } });
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    expect(storage.get("essenly.favorites.owner")).toBe("user-1");
    expect(JSON.parse(storage.get("essenly.favorites") ?? "{}").place).toEqual(["unsynced"]);
    expect(pending.has("myseouldrop.signup-return.favorite")).toBe(true);
  });

  it("sweeps a stale mirror on a guest page load without touching the guest's own pending request", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["left-behind"], product: [], article: [] }));
    storage.set("essenly.favorites.owner", "user-9"); // a session that ended without a clean sign-out
    const pending = new Map<string, string>([["myseouldrop.signup-return.favorite", JSON.stringify({ placeId: "p1", placeName: "P1", requestId: "r1" })]]);
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => pending.get(k) ?? null, setItem: (k: string, v: string) => pending.set(k, v), removeItem: (k: string) => pending.delete(k) });
    mocks.uid = null; // a guest; getUser answers with no session
    mocks.getUser = () => Promise.resolve({ data: { user: null }, error: { name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" } });
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    expect(storage.has("essenly.favorites")).toBe(false);
    expect(storage.has("essenly.favorites.owner")).toBe(false);
    expect(pending.has("myseouldrop.signup-return.favorite")).toBe(true);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("sends one item's writes in order: the member's DELETE waits for the slow UPSERT, so the server ends unsaved", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((settled) => { apply(row); return settled; }));
    const outcome = store.saveFavorite("place", "p1");
    await flush(); // the UPSERT is now in flight
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(store.toggleFavorite("place", "p1")).toBe(false); // the member removes it again while the save is still in flight
    await flush();
    expect(mocks.del).not.toHaveBeenCalled(); // queued behind the upsert, not racing it
    slowUpsert.resolve({ error: null });
    await expect(outcome).resolves.toBe("superseded");
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("sends nothing at all for a save the member reversed before it went out (intents in one tick coalesce)", async () => {
    const store = await loadStore();
    const outcome = store.saveFavorite("place", "p1");
    expect(store.toggleFavorite("place", "p1")).toBe(false); // reversed before the UPSERT was dispatched
    await expect(outcome).resolves.toBe("superseded");
    await flush();
    expect(mocks.upsert).not.toHaveBeenCalled(); // nothing to undo on the server
    expect(mocks.del).not.toHaveBeenCalled(); // and nothing to remove: the server never had it
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("shows the server's state again when a sent write fails: a failed un-heart puts the heart back", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    const store = await loadStore();
    mocks.del.mockResolvedValueOnce({ error: { message: "boom" } });
    expect(store.toggleFavorite("place", "p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]); // optimistic
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1); // really sent, and it failed
    expect(has("p1")).toBe(true);
    expect(store.useFavorites().place).toEqual(["p1"]); // the view falls back to what the server holds
  });

  it("does not report saved when the member removed the item while the confirmation request was in flight", async () => {
    // Before the snapshot: the mirror shows p1, so saveFavorite confirms it with the server.
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "p1" }];
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] }));
    storage.set("essenly.favorites.owner", "user-1");
    storage.set("essenly.favorites.mergedFor", "user-1");
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    const slowConfirm = deferred();
    mocks.upsert.mockImplementationOnce(() => slowConfirm.promise);
    const outcome = store.saveFavorite("place", "p1");
    await flush(); // the confirmation UPSERT is in flight
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(store.toggleFavorite("place", "p1")).toBe(false);
    slowConfirm.resolve({ error: null });
    await expect(outcome).resolves.toBe("superseded");
    await flush();
    slowList.resolve({ data: [{ kind: "place", item_id: "p1" }], error: null });
    await flush();
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("keeps a toggle that completed while the account snapshot was still loading", async () => {
    mocks.server = [{ user_id: "user-1", kind: "place", item_id: "old" }];
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    expect(store.useFavoritesReady()).toBe(false); // snapshot in flight
    expect(store.toggleFavorite("place", "p1")).toBe(true);
    await flush(); // the upsert has landed; the snapshot read before it has not
    expect(has("p1")).toBe(true);
    slowList.resolve({ data: [{ kind: "place", item_id: "old" }], error: null });
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
    expect(store.useFavorites().place).toEqual(["p1", "old"]);
  });

  it("does not resurrect a toggle that FAILED while the snapshot was loading", async () => {
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    mocks.upsert.mockResolvedValueOnce({ error: { message: "boom" } });
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    expect(store.toggleFavorite("place", "p1")).toBe(true);
    await flush(); // failed and rolled back
    expect(store.useFavorites().place).toEqual([]);
    slowList.resolve({ data: [], error: null });
    await flush();
    expect(store.useFavorites().place).toEqual([]);
  });

  it("queues the sign-in merge with the item's other writes, so a heart removed during the merge stays removed on the server", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] })); // a legacy guest list on this device
    const slowMerge = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowMerge.promise.then((settled) => { apply(row); return settled; }));
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush();
    expect(store.useFavoritesReady()).toBe(false); // merge in flight
    expect(store.useFavorites().place).toEqual(["p1"]);
    expect(store.toggleFavorite("place", "p1")).toBe(false); // removed while the merge upsert is still running
    await flush();
    expect(mocks.del).not.toHaveBeenCalled();
    slowMerge.resolve({ error: null });
    await flush();
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(has("p1")).toBe(false);
    expect(store.useFavoritesReady()).toBe(true);
    expect(store.useFavorites().place).toEqual([]);
  });

  it("reports the server's answer after a mid-save sign-out and keeps that account's row out of the next account's list", async () => {
    const store = await loadStore();
    const slowUpsert = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowUpsert.promise.then((settled) => { apply(row); return settled; }));
    const outcome = store.saveFavorite("place", "p1");
    await flush(); // dispatched for user-1
    mocks.authChange?.("SIGNED_OUT", null);
    expect(store.useFavorites().place).toEqual([]); // guest view
    mocks.uid = "user-2";
    const slowList = deferred<{ data: { kind: string; item_id: string }[]; error: null }>();
    mocks.list.mockImplementationOnce(() => slowList.promise);
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-2" } });
    await flush(); // user-2's snapshot is in flight
    slowUpsert.resolve({ error: null }); // user-1's save lands now
    await expect(outcome).resolves.toBe("saved"); // the row exists in user-1's account
    expect(has("p1", "user-1")).toBe(true);
    slowList.resolve({ data: [], error: null });
    await flush();
    expect(store.useFavoritesReady()).toBe(true);
    expect(store.useFavorites().place).toEqual([]); // user-2 never sees user-1's heart
    expect(has("p1", "user-2")).toBe(false);
  });

  it("resolves failed for a guest so the request is kept for after sign-in", async () => {
    mocks.uid = null;
    const store = await loadStore();
    await expect(store.saveFavorite("place", "p1")).resolves.toBe("failed");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("the legacy merge uses the item's single request path", () => {
  it("joins a merge row already on the wire after a same-account revive instead of sending it twice, and the member's removal still wins", async () => {
    storage.set("essenly.favorites", JSON.stringify({ place: ["p1"], product: [], article: [] })); // untagged legacy guest list
    const slowMerge = deferred();
    mocks.upsert.mockImplementationOnce((row: Row) => slowMerge.promise.then((settled) => { apply(row); return settled; }));
    const store = await import("./favorites");
    store.useFavoritesReady();
    await flush(); // merge UPSERT for p1 is on the wire
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    mocks.authChange?.("TOKEN_REFRESHED", null); // the session drops without a sign-out: the mirror stays
    mocks.authChange?.("SIGNED_IN", { user: { id: "user-1" } }); // and comes straight back
    await flush();
    expect(mocks.upsert).toHaveBeenCalledTimes(1); // joined, not repeated
    expect(store.toggleFavorite("place", "p1")).toBe(false); // the member removes it while the merge row is still in flight
    await flush();
    expect(mocks.del).not.toHaveBeenCalled(); // queued behind the merge row
    slowMerge.resolve({ error: null });
    await flush();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(has("p1")).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });
});

// The device mirror is tagged with the account it caches, so one account's
// leftover list is never shown to, or merged into, another account.
describe("device mirror ownership", () => {
  const OWNER = "essenly.favorites.owner";
  const MERGED = "essenly.favorites.mergedFor";
  const LIST = "essenly.favorites";

  it("tags the mirror with the signed-in account", async () => {
    const store = await loadStore();
    store.toggleFavorite("place", "p1");
    await flush();
    expect(storage.get(OWNER)).toBe("user-1");
    expect(JSON.parse(storage.get(LIST) ?? "{}").place).toEqual(["p1"]);
  });

  it("drops another account's mirror at sign-in: never shown, never merged into this account", async () => {
    storage.set(LIST, JSON.stringify({ place: ["left-by-user-2"], product: [], article: [] }));
    storage.set(OWNER, "user-2"); // user-2's session ended without a clean sign-out, and its merge never completed
    const store = await loadStore();
    expect(store.useFavorites().place).toEqual([]);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(has("left-by-user-2")).toBe(false);
    expect(storage.get(OWNER)).toBe("user-1");
  });

  it("never re-uploads the account's own cache once its merge completed (a heart removed elsewhere stays removed)", async () => {
    storage.set(LIST, JSON.stringify({ place: ["removed-on-another-device"], product: [], article: [] }));
    storage.set(OWNER, "user-1");
    storage.set(MERGED, "user-1");
    const store = await loadStore();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(store.useFavorites().place).toEqual([]); // the snapshot replaced the stale cache
  });

  it("merges an untagged legacy guest list once, and retries next session if that merge failed", async () => {
    storage.set(LIST, JSON.stringify({ place: ["legacy"], product: [], article: [] }));
    mocks.upsert.mockResolvedValueOnce({ error: { message: "offline" } });
    let store = await loadStore();
    expect(storage.get(MERGED)).toBeUndefined(); // not merged yet
    expect(storage.get(OWNER)).toBe("user-1"); // but already this account's: no other account may take it
    expect(has("legacy")).toBe(false);
    vi.resetModules();
    store = await loadStore(); // next session on this device, same account
    expect(has("legacy")).toBe(true);
    expect(storage.get(MERGED)).toBe("user-1");
    expect(store.useFavorites().place).toEqual(["legacy"]);
  });

  it("sign-out wipes the mirror, its owner tag and the merge flag", async () => {
    const store = await loadStore();
    store.toggleFavorite("place", "p1");
    await flush();
    store.purgeFavoritesMirror();
    expect(storage.has(LIST)).toBe(false);
    expect(storage.has(OWNER)).toBe(false);
    expect(storage.has(MERGED)).toBe(false);
    expect(store.useFavorites().place).toEqual([]);
  });
});
