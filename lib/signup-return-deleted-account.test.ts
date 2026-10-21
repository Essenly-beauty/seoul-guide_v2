import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// p2-contract-1 repro. Real lib/favorites + real lib/signup-return + the
// real SignupReturnNotice (hooks emulated as in lib/signup-return-handover.test.ts).
//
// Account deletion (components/settings/account-data-controls.tsx) calls
// POST /api/account/delete -> the SERVER signs out (clears the cookies), then the
// client calls purgeFavoritesMirror() and router.push("/"). The browser Supabase
// client never emits SIGNED_OUT (nothing on the client removed its session; cookie
// storage has no change listener), so the root-layout SignupReturnNotice keeps the
// deleted user's id from useAuthUser, while the favorites store is now a guest.

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
}));
const mocks = vi.hoisted(() => ({
  uid: null as string | null,
  server: [] as { user_id: string; kind: string; item_id: string }[],
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));

vi.mock("react", () => ({
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
  useSyncExternalStore: (subscribe: (cb: () => void) => unknown, get: () => unknown) => { subscribe(() => {}); return get(); },
}));
vi.mock("next/navigation", () => ({ usePathname: () => rt.pathname }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: rt.user, loading: false }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: rt.toast }) }));

const has = (id: string, uid: string) => mocks.server.some((row) => row.item_id === id && row.user_id === uid);
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: mocks.uid ? { id: mocks.uid } : null }, error: mocks.uid ? null : { name: "AuthSessionMissingError", status: 400 } }),
    onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({
    select: () => ({ eq: (_c: string, scoped: string) => ({ order: async () => ({ data: mocks.server.filter((r) => r.user_id === mocks.uid && r.user_id === scoped).map(({ kind, item_id }) => ({ kind, item_id })), error: null }) }) }),
    // RLS: a write is accepted only for the token's own user
    upsert: async (row: Row) => {
      if (row.user_id !== mocks.uid) return { error: { message: "new row violates row-level security policy" } };
      if (!has(row.item_id, row.user_id)) mocks.server.push(row);
      return { error: null };
    },
    delete: () => ({ match: async () => ({ error: null }) }),
  }),
}) }));

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
let Notice: () => unknown;
async function render() {
  rt.refIdx = 0; rt.effIdx = 0; rt.queue = [];
  Notice();
  rt.queue.forEach((run) => run());
  await flush();
}

let local: Map<string, string>;
let session: Map<string, string>;
beforeEach(async () => {
  vi.resetModules();
  rt.refs = []; rt.effects = []; rt.pathname = "/settings/account"; rt.user = null;
  rt.toast.mockReset();
  mocks.uid = null; mocks.server = []; mocks.authChange = null;
  local = new Map(); session = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => local.set(k, v), removeItem: (k: string) => local.delete(k) });
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  ({ SignupReturnNotice: Notice } = await import("@/components/auth/signup-return-notice"));
});
afterEach(() => vi.unstubAllGlobals());

describe("p2-contract-1: account deleted in this tab, no SIGNED_OUT reaches the layout notice", () => {
  it("a guest's later pre-signup heart is not claimed by the deleted account, shows no failure toast, and is saved into B", async () => {
    // Signed in as A; the favorites store has A's session and is ready.
    mocks.uid = "A"; rt.user = { id: "A" };
    await render();
    await render();

    // Settings > Delete account succeeded: the server deleted A and cleared the cookies
    // (getUser now answers AuthSessionMissingError, which auth-js 2.112 returns without
    // calling _removeSession, so no SIGNED_OUT). AccountDataControls purges + router.push("/").
    mocks.uid = null;
    const store = await import("@/lib/favorites");
    store.purgeFavoritesMirror();
    expect(store.canSaveFavorites()).toBe(false); // store is a guest now
    rt.pathname = "/";
    await render(); // the root-layout notice still holds useAuthUser().user = A

    // Guest hearts p1 -> join sheet -> "Sign up with email" (rememberSavedPlace + client nav)
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    rt.pathname = "/register";
    await render();

    const afterRegisterNav = { claimedBy: peekPendingFavoriteReturn()?.claimedBy ?? null, toasts: rt.toast.mock.calls.map((c) => c[0]) };

    // They join as B: client-side sign-up emits SIGNED_IN to every subscriber
    mocks.uid = "B"; rt.user = { id: "B" };
    mocks.authChange?.("SIGNED_IN", { user: { id: "B" } });
    await flush();
    rt.pathname = "/map";
    await render();
    await render();

    expect({ ...afterRegisterNav, savedForB: has("p1", "B") }).toEqual({ claimedBy: null, toasts: [], savedForB: true });
  });
});
