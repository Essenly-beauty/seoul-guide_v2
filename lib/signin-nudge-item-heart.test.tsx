import { beforeEach, describe, expect, it, vi } from "vitest";

// --- tiny hook shim: one hooks array per mounted component, manual re-render ---
type Inst = { hooks: unknown[]; i: number };
let current: Inst | null = null;
vi.mock("react", () => ({
  useState: (init: unknown) => {
    const inst = current!; const idx = inst.i++;
    if (!(idx in inst.hooks)) inst.hooks[idx] = typeof init === "function" ? (init as () => unknown)() : init;
    return [inst.hooks[idx], (v: unknown) => { inst.hooks[idx] = typeof v === "function" ? (v as (p: unknown) => unknown)(inst.hooks[idx]) : v; }];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (v: unknown) => ({ current: v }),
  useSyncExternalStore: (_s: unknown, g: () => unknown) => g(),
}));
function mount<P>(C: (p: P) => unknown, props: P) {
  const inst: Inst = { hooks: [], i: 0 };
  return () => { inst.i = 0; current = inst; try { return C(props); } finally { current = null; } };
}
// test-only element walker over the mocked React tree
type El = { type: unknown; props: Record<string, any> };
function find(node: unknown, pred: (e: El) => boolean): El | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const f = find(n, pred); if (f) return f; } return null; }
  const e = node as El;
  if (e.props && pred(e)) return e;
  return e.props ? find(e.props.children, pred) : null;
}
const text = (e: El) => JSON.stringify(e.props.children ?? "");

const toggleFavorite = vi.fn();
vi.mock("@/lib/favorites", () => ({ useFavorites: () => ({ place: [], product: [], article: [] }), toggleFavorite: (...a: unknown[]) => toggleFavorite(...a) }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/i18n/locale-provider", () => ({ useLocale: () => ({ t: (s: string) => s }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/shop/prod1" }));
vi.mock("next/link", () => ({ default: function Link() { return null; } }));
vi.mock("@/components/ui/bottom-sheet", () => ({ BottomSheet: function BottomSheet() { return null; } }));
vi.mock("@/components/ui/button", () => ({ Button: function Button() { return null; } }));
vi.mock("@/components/ui/icon-button", () => ({ IconButton: function IconButton() { return null; } }));
vi.mock("@/components/brand/auth-glyphs", () => ({ GoogleGlyph: function GoogleGlyph() { return null; } }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/install-nudge", () => ({ recordValueMoment: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({}) }));
vi.mock("@/lib/data", () => ({ getPlace: (id: string) => (id === "p1" ? { id: "p1", name: "Place One" } : undefined) }));

const ev = { preventDefault() {}, stopPropagation() {} };

describe("fav-flow-4: guest product heart join sheet", () => {
  beforeEach(() => {
    vi.resetModules();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) });
  });

  it("a product heart's join sheet neither promises 'this place' nor fulfils an older place request", async () => {
    const { FavoriteButton } = await import("@/components/ui/favorite-button");
    const sr = await import("@/lib/signup-return");

    // 1) Guest hearts place P1, taps "Sign in" on the sheet, then backs out (no sign-in).
    const renderPlace = mount(FavoriteButton as never, { kind: "place", id: "p1" } as never);
    let tree = renderPlace();
    find(tree, (e) => typeof e.props.onClick === "function" && "name" in e.props)!.props.onClick!.call(null, ev);
    tree = renderPlace();
    find(tree, (e) => text(e).includes("Sign in") && "href" in e.props)!.props.onClick!.call(null);
    expect(sr.peekPendingFavoriteReturn()?.placeId).toBe("p1");

    // 2) Later, same tab: guest hearts a PRODUCT and taps "Sign up with email".
    const renderProduct = mount(FavoriteButton as never, { kind: "product", id: "prod1" } as never);
    tree = renderProduct();
    find(tree, (e) => typeof e.props.onClick === "function" && "name" in e.props)!.props.onClick!.call(null, ev);
    tree = renderProduct();
    const sheet = find(tree, (e) => "kicker" in e.props)!;
    const body = find(sheet, (e) => e.type === "p" && typeof e.props.children === "string")!;
    console.log("product sheet body:", body.props.children);
    find(sheet, (e) => e.props.children === "Sign up with email")!.props.onClick!.call(null);

    const pending = sr.peekPendingFavoriteReturn();
    console.log("pending after product sheet sign-up:", JSON.stringify(pending));
    console.log("toggleFavorite calls (guest product heart):", toggleFavorite.mock.calls.length);

    // Correct behaviour: the request now pending after joining is the product (or none) — never stale P1.
    expect(pending?.placeId, "stale place request would be saved+announced after joining from the product sheet").not.toBe("p1");
    // And the copy should not call a product a "place".
    expect(body.props.children).not.toMatch(/this place/);
  });
});
