import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Repro: after the post-sign-in save failed once, the member hearts and then
// un-hearts the same place themselves. The stored pre-signup request is still
// there, so the next route change re-saves the place over the member's own
// removal (real favorites store + real notice; React hooks emulated).

type Row = { user_id: string; kind: string; item_id: string };
const rt = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIdx: 0,
  effects: [] as ({ deps?: unknown[]; cleanup?: () => void } | undefined)[],
  effIdx: 0,
  queue: [] as (() => void)[],
  pathname: "/map",
  user: null as null | { id: string },
  toast: vi.fn(),
  uid: "user-1" as string | null,
  server: [] as Row[],
  upsert: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
}));

vi.mock("react", () => ({
  useSyncExternalStore: (subscribe: (cb: () => void) => unknown, get: () => unknown) => { subscribe(() => {}); return get(); },
  useRef: (init: unknown) => {
    const i = rt.refIdx++;
    if (!rt.refs[i]) rt.refs[i] = { current: init };
    return rt.refs[i];
  },
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
    const i = rt.effIdx++;
    const prev = rt.effects[i];
    const changed = !prev || !deps || deps.length !== prev.deps?.length || deps.some((d, k) => !Object.is(d, prev.deps?.[k]));
    if (!changed) return;
    rt.queue.push(() => {
      prev?.cleanup?.();
      const cleanup = fn();
      rt.effects[i] = { deps, cleanup: typeof cleanup === "function" ? cleanup : undefined };
    });
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => rt.pathname }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: rt.user, loading: false }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: rt.toast }) }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: async () => ({ data: { user: rt.uid ? { id: rt.uid } : null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: () => ({ select: () => ({ eq: () => ({ order: rt.list }) }), upsert: rt.upsert, delete: () => ({ match: rt.del }) }),
}) }));

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const has = (id: string) => rt.server.some((row) => row.item_id === id && row.user_id === "user-1");

let Notice: () => unknown;
async function render() {
  rt.refIdx = 0; rt.effIdx = 0; rt.queue = [];
  Notice();
  rt.queue.forEach((run) => run());
  await flush();
}

beforeEach(async () => {
  vi.resetModules();
  rt.refs = []; rt.effects = []; rt.pathname = "/map"; rt.user = { id: "user-1" }; rt.uid = "user-1"; rt.server = [];
  rt.toast.mockReset();
  rt.upsert.mockReset().mockImplementation(async (row: Row) => { if (!has(row.item_id)) rt.server.push(row); return { error: null }; });
  rt.del.mockReset().mockImplementation(async (m: Row) => { rt.server = rt.server.filter((r) => r.item_id !== m.item_id); return { error: null }; });
  rt.list.mockReset().mockImplementation(async () => ({ data: rt.server.map(({ kind, item_id }) => ({ kind, item_id })), error: null }));
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => local.set(k, v), removeItem: (k: string) => local.delete(k) });
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  ({ SignupReturnNotice: Notice } = await import("@/components/auth/signup-return-notice"));
});
afterEach(() => vi.unstubAllGlobals());

describe("pre-signup request vs the member's own later toggles", () => {
  it("does not re-save a place the member removed after the first attempt failed", async () => {
    const { setPendingFavoriteReturn } = await import("@/lib/signup-return");
    const store = await import("@/lib/favorites");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    store.useFavoritesReady(); // wire auth + adopt user-1
    await flush();
    expect(store.useFavoritesReady()).toBe(true);

    rt.upsert.mockResolvedValueOnce({ error: { message: "offline" } });
    await render(); // notice: first attempt fails, request kept
    expect(rt.toast).toHaveBeenLastCalledWith(expect.stringContaining("Couldn't save Place One"), 4000);
    expect(has("p1")).toBe(false);

    expect(store.toggleFavorite("place", "p1")).toBe(true); // the member hearts it themselves
    await flush();
    expect(store.toggleFavorite("place", "p1")).toBe(false); // ...and then removes it
    await flush();
    expect(has("p1")).toBe(false);

    rt.pathname = "/favorites"; // next screen
    await render();
    expect(has("p1")).toBe(false); // the member's removal must stand
    expect(store.useFavorites().place).toEqual([]);
  });
});
