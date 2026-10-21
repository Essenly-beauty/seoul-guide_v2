import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SignupReturnNotice has no test in the repo. Minimal hook harness: useRef and
// useEffect are emulated (effects re-run when deps change), everything the
// component reads is mocked, lib/signup-return is the real module on a fake
// sessionStorage.

const h = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  queue: [] as (() => void)[],
  r: 0,
  e: 0,
  user: null as null | { id: string },
  ready: true,
  pathname: "/map",
  saveFavorite: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("react", () => ({
  useRef: (init: unknown) => (h.refs[h.r++] ??= { current: init }),
  useEffect: (fn: () => void | (() => void), deps: unknown[]) => {
    const i = h.e++;
    const prev = h.effects[i];
    if (prev && deps.every((d, k) => Object.is(d, prev.deps[k]))) return;
    h.queue.push(() => {
      prev?.cleanup?.();
      const cleanup = fn();
      h.effects[i] = { deps, cleanup: cleanup ?? undefined };
    });
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => h.pathname }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: h.user, loading: false }) }));
vi.mock("@/lib/favorites", () => ({ saveFavorite: h.saveFavorite, useFavoritesReady: () => h.ready, favoritesAccount: () => (h.user as { id?: string } | null)?.id ?? null }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: h.toast }) }));

const tick = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
let Notice: () => unknown;
async function render() {
  h.r = 0; h.e = 0; h.queue = [];
  Notice();
  h.queue.forEach((run) => run());
  await tick();
}

beforeEach(async () => {
  vi.resetModules();
  Object.assign(h, { refs: [], effects: [], user: null, ready: true, pathname: "/map" });
  h.saveFavorite.mockReset();
  h.toast.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  ({ SignupReturnNotice: Notice } = await import("@/components/auth/signup-return-notice"));
});
afterEach(() => vi.unstubAllGlobals());

describe("tests-2: SignupReturnNotice across an account change", () => {
  it("does not save the first account's pre-signup heart into the next account on this tab", async () => {
    const { setPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" }); // guest hearts p1, taps Sign in

    let finish!: (v: string) => void;
    h.saveFavorite.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
    h.user = { id: "A" };
    await render(); // A is back signed in: the save starts
    expect(h.saveFavorite).toHaveBeenCalledTimes(1);

    h.user = null;
    await render(); // A signs out while the request is in flight
    finish("saved"); // the row lands in A's account
    await tick();

    h.saveFavorite.mockResolvedValue("saved");
    h.user = { id: "B" };
    await render(); // B signs in on the same tab

    expect(h.saveFavorite).toHaveBeenCalledTimes(1); // B never hearted p1
    expect(h.toast).not.toHaveBeenCalled();
  });
  it("does not replay a FAILED save of the first account into the next account after sign-out", async () => {
    const { setPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    h.saveFavorite.mockResolvedValueOnce("failed"); // A is back, but the write fails (offline)
    h.user = { id: "A" };
    await render();
    expect(h.saveFavorite).toHaveBeenCalledTimes(1);
    h.user = null; h.pathname = "/menu";
    await render(); // A signs out; the request is still stored
    h.saveFavorite.mockResolvedValue("saved");
    h.user = { id: "B" }; h.pathname = "/map";
    await render(); // B signs in on the same tab
    expect(h.saveFavorite).toHaveBeenCalledTimes(1);
  });
});


describe("tests-2: control (same account) still works", () => {
  it("saves once and clears on success for the same account", async () => {
    const { setPendingFavoriteReturn, peekPendingFavoriteReturn } = await import("@/lib/signup-return");
    setPendingFavoriteReturn({ placeId: "p1", placeName: "Place One" });
    h.saveFavorite.mockResolvedValue("saved");
    h.user = { id: "A" };
    await render();
    expect(h.saveFavorite).toHaveBeenCalledTimes(1);
    expect(peekPendingFavoriteReturn()).toBeNull();
    expect(h.toast).toHaveBeenCalledTimes(1);
  });
});
