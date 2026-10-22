import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests lens: SignupReturnNotice contracts the suite leaves unpinned (mutants
// N1 N3 N7 N8 N9 from tlnotice-run.mjs). Hook harness copied from
// lib/signup-return-handover.test.ts (useRef/useEffect emulated, store mocked).

const rt = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIdx: 0,
  effects: [] as ({ deps?: unknown[]; cleanup?: () => void } | undefined)[],
  effIdx: 0,
  queue: [] as (() => void)[],
  pathname: "/map",
  user: null as null | { id: string },
  ready: true,
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
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: rt.user, loading: false }) }));
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
  rt.refIdx = 0; rt.effIdx = 0; rt.queue = [];
  Notice();
  rt.queue.forEach((run) => run());
  await flush();
}

beforeEach(async () => {
  vi.resetModules();
  rt.refs = []; rt.effects = []; rt.pathname = "/map"; rt.user = { id: "A" }; rt.ready = true;
  rt.toast.mockReset();
  rt.saveFavorite.mockReset();
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
  ({ SignupReturnNotice: Notice } = await import("@/components/auth/signup-return-notice"));
});
afterEach(() => vi.unstubAllGlobals());

describe("SignupReturnNotice contracts", () => {
  it("NP1 [N1 N3]: a failed save keeps the request and retries on the next screen", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    rt.saveFavorite.mockResolvedValueOnce("failed").mockResolvedValueOnce("saved");
    await render();
    expect(peekPendingFavoriteReturn()?.placeId).toBe("p1");
    rt.pathname = "/favorites";
    await render();
    expect(rt.saveFavorite).toHaveBeenCalledTimes(2);
    expect(peekPendingFavoriteReturn()).toBeNull();
    expect(rt.toast).toHaveBeenLastCalledWith(expect.stringContaining("Place One saved"), 3000);
  });

  it("NP2 [N7]: nothing is saved until the favorites store is ready", async () => {
    const { setPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    rt.saveFavorite.mockResolvedValue("saved");
    rt.ready = false;
    await render();
    expect(rt.saveFavorite).not.toHaveBeenCalled();
    rt.ready = true;
    await render();
    expect(rt.saveFavorite).toHaveBeenCalledTimes(1);
  });

  it("NP3 [N8]: a save finishing late clears only its own request, never a newer one stored meanwhile", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    const slow = deferred<string>();
    rt.saveFavorite.mockImplementationOnce(() => slow.promise);
    await render();
    setPendingFavoriteReturn({ placeId: "p2", placeName: "Place Two" }); // a newer request (e.g. after sign-out, a new visitor in this tab)
    slow.resolve("saved");
    await flush();
    expect(peekPendingFavoriteReturn()?.placeId).toBe("p2");
  });

  it("NP4 [N9]: a request the member superseded clears silently", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    rt.saveFavorite.mockResolvedValueOnce("superseded");
    await render();
    expect(peekPendingFavoriteReturn()).toBeNull();
    expect(rt.toast).not.toHaveBeenCalled();
  });
});
