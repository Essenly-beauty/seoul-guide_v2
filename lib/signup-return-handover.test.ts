import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Repro: SignupReturnNotice keeps a request whose save finished after the
// account changed ("leave its request alone"), and nothing else (sign-out,
// account switch) clears it — so the guest's heart is replayed into the NEXT
// account that is signed in on this tab, and announced on that account's screen.

const rt = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIdx: 0,
  effects: [] as ({ deps?: unknown[]; cleanup?: () => void } | undefined)[],
  effIdx: 0,
  queue: [] as (() => void)[],
  pathname: "/map",
  user: null as null | { id: string },
  loading: false,
  ready: false,
  toast: vi.fn(),
  saveFavorite: vi.fn(),
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
}));
vi.mock("next/navigation", () => ({ usePathname: () => rt.pathname }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: rt.user, loading: rt.loading }) }));
vi.mock("@/lib/favorites", () => ({ saveFavorite: rt.saveFavorite, useFavoritesReady: () => rt.ready, favoritesAccount: () => (rt.user as { id?: string } | null)?.id ?? null }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: rt.toast }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

let Notice: () => unknown;
async function render() {
  rt.refIdx = 0;
  rt.effIdx = 0;
  rt.queue = [];
  Notice();
  rt.queue.forEach((run) => run());
  await flush();
}

let session: Map<string, string>;
beforeEach(async () => {
  vi.resetModules();
  rt.refs = []; rt.effects = []; rt.pathname = "/map"; rt.user = null; rt.loading = false; rt.ready = false;
  rt.toast.mockReset();
  rt.saveFavorite.mockReset();
  session = new Map();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
  ({ SignupReturnNotice: Notice } = await import("@/components/auth/signup-return-notice"));
});
afterEach(() => vi.unstubAllGlobals());

describe("SignupReturnNotice account hand-over", () => {
  it("does not replay a guest's heart into the next account after the first account's save finished", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" }); // guest hearted p1, chose Sign in

    // signed in as A; the store is ready; the save starts
    const first = deferred<string>();
    rt.saveFavorite.mockImplementationOnce(() => first.promise);
    rt.user = { id: "A" }; rt.ready = true;
    await render();
    expect(rt.saveFavorite).toHaveBeenCalledTimes(1);

    // A switches account to B (Settings -> Switch account) while A's request is in flight
    rt.user = { id: "B" }; rt.ready = false;
    await render();
    rt.ready = true;
    await render();

    first.resolve("saved"); // A's account now has p1
    await flush();

    // B keeps browsing
    rt.saveFavorite.mockResolvedValue("saved");
    rt.pathname = "/menu";
    await render();

    expect(peekPendingFavoriteReturn()).toBeNull(); // the request was fulfilled for A
    expect(rt.saveFavorite).toHaveBeenCalledTimes(1); // ...so B's account must not receive p1
    expect(rt.toast).not.toHaveBeenCalled(); // ...nor B's screen announce it
  });

  it("drops the request when the account that claimed it signs out after a failed save", async () => {
    const { setPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    rt.saveFavorite.mockResolvedValueOnce("failed"); // A's save fails (offline)
    rt.user = { id: "A" }; rt.ready = true;
    await render();
    expect(rt.saveFavorite).toHaveBeenCalledTimes(1);

    // A signs out; later B signs in on the same tab
    rt.user = null; rt.pathname = "/";
    await render();
    rt.user = { id: "B" }; rt.pathname = "/map";
    rt.saveFavorite.mockResolvedValue("saved");
    await render();

    expect(rt.saveFavorite).toHaveBeenCalledTimes(1); // B must not inherit A's pending heart
  });
});
