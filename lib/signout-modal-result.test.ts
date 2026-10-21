import { beforeEach, describe, expect, it, vi } from "vitest";

// SignoutModal must act on what signOut() reports. Offline with an expired
// access token, auth-js returns { error } and keeps the session on the device
// (no SIGNED_OUT); the next token refresh would bring the account back. The
// modal then has to say so instead of purging the mirrors and navigating as if
// the member had signed out (review 2026-10-21, p2-races-2).

type Inst = { hooks: unknown[]; i: number };
let current: Inst | null = null;
vi.mock("react", () => ({
  useState: (init: unknown) => {
    const inst = current!; const idx = inst.i++;
    if (!(idx in inst.hooks)) inst.hooks[idx] = typeof init === "function" ? (init as () => unknown)() : init;
    return [inst.hooks[idx], (v: unknown) => { inst.hooks[idx] = typeof v === "function" ? (v as (p: unknown) => unknown)(inst.hooks[idx]) : v; }];
  },
  useRef: (v: unknown) => ({ current: v }),
  useEffect: () => {},
  useCallback: (fn: unknown) => fn,
}));
function mount<P>(C: (p: P) => unknown, props: P) {
  const inst: Inst = { hooks: [], i: 0 };
  return () => { inst.i = 0; current = inst; try { return C(props); } finally { current = null; } };
}
type El = { type: unknown; props: Record<string, unknown> };
function find(node: unknown, pred: (e: El) => boolean): El | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const f = find(n, pred); if (f) return f; } return null; }
  const e = node as El;
  if (e.props && pred(e)) return e;
  return e.props ? find(e.props.children, pred) : null;
}

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  purgeFav: vi.fn(),
  purgeProfile: vi.fn(),
  purgeRatings: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({ auth: { signOut: h.signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("@/lib/favorites", () => ({ purgeFavoritesMirror: () => h.purgeFav() }));
vi.mock("@/lib/profile", () => ({ purgeProfileMirror: () => h.purgeProfile() }));
vi.mock("@/lib/ratings", () => ({ purgeRatingsMirror: () => h.purgeRatings() }));
vi.mock("@/components/ui/button", () => ({ Button: function Button() { return null; } }));
vi.mock("@/components/ui/notice", () => ({ Notice: function Notice() { return null; } }));
vi.mock("@/components/icon", () => ({ Icon: function Icon() { return null; } }));
vi.mock("@/components/ui/use-dialog-focus", () => ({ useDialogFocus: () => ({ current: null }) }));
vi.mock("@/components/ui/use-exit-transition", () => ({ useExitTransition: (open: boolean) => ({ mounted: open, closing: false }) }));

async function tapConfirm() {
  const { SignoutModal } = await import("@/components/ui/signout-modal");
  const render = mount(SignoutModal as never, {} as never);
  let tree = render();
  const opener = find(tree, (e) => e.props.variant === "danger" && !e.props.style);
  (opener!.props.onClick as () => void)();
  tree = render();
  const confirm = find(tree, (e) => e.props.variant === "danger" && (e.props.style as { flex?: number } | undefined)?.flex === 1);
  await (confirm!.props.onClick as () => Promise<void>)();
  return render();
}
const alertShown = (tree: unknown) => find(tree, (e) => (e.type as { name?: string })?.name === "Notice" && e.props.role === "alert") !== null;

beforeEach(() => {
  vi.resetModules();
  for (const fn of Object.values(h)) fn.mockReset();
});

describe("SignoutModal acts on signOut()'s result", () => {
  it("keeps the member signed in, and says so, when signOut reports an error (offline)", async () => {
    h.signOut.mockResolvedValue({ error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" } });
    const tree = await tapConfirm();
    expect(h.purgeFav).not.toHaveBeenCalled();
    expect(h.purgeProfile).not.toHaveBeenCalled();
    expect(h.purgeRatings).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
    expect(alertShown(tree)).toBe(true);
  });

  it("treats a thrown signOut like a reported failure", async () => {
    h.signOut.mockRejectedValue(new TypeError("Failed to fetch"));
    const tree = await tapConfirm();
    expect(h.purgeFav).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
    expect(alertShown(tree)).toBe(true);
  });

  it("purges every device mirror and leaves for the welcome screen once signed out", async () => {
    h.signOut.mockResolvedValue({ error: null });
    const tree = await tapConfirm();
    expect(h.purgeFav).toHaveBeenCalledTimes(1);
    expect(h.purgeProfile).toHaveBeenCalledTimes(1);
    expect(h.purgeRatings).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(alertShown(tree)).toBe(false);
  });
});
