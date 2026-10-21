import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal hook runner: useState + useEffect with dependency comparison, enough
// to drive components/place/use-published-place.ts without a DOM.
const runtime = vi.hoisted(() => ({
  states: [] as unknown[],
  effects: [] as ({ deps?: unknown[]; cleanup?: () => void } | undefined)[],
  idx: 0,
  pending: [] as (() => void)[],
  dirty: false,
}));

vi.mock("react", () => ({
  useState: (init: unknown) => {
    const i = runtime.idx++;
    if (!(i in runtime.states)) runtime.states[i] = typeof init === "function" ? (init as () => unknown)() : init;
    const set = (value: unknown) => {
      const next = typeof value === "function" ? (value as (v: unknown) => unknown)(runtime.states[i]) : value;
      if (!Object.is(next, runtime.states[i])) { runtime.states[i] = next; runtime.dirty = true; }
    };
    return [runtime.states[i], set];
  },
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
    const i = runtime.idx++;
    const prev = runtime.effects[i];
    const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, k) => !Object.is(d, prev.deps![k]));
    if (changed) runtime.pending.push(() => {
      prev?.cleanup?.();
      const cleanup = fn();
      runtime.effects[i] = { deps, cleanup: typeof cleanup === "function" ? cleanup : undefined };
    });
  },
}));

type Place = import("@/lib/data").Place;
type Hook = (place: Place | null) => unknown;

function renderOnce(hook: Hook, place: Place | null) {
  runtime.idx = 0;
  runtime.dirty = false;
  const out = hook(place);
  const effects = runtime.pending.splice(0);
  effects.forEach((run) => run());
  return out;
}
function unmount() {
  runtime.effects.forEach((effect) => effect?.cleanup?.());
  runtime.effects = [];
  runtime.states = [];
}

// The real route rule from app/api/places/[id]/profile/route.ts and
// app/api/places/[id]/media/route.ts: anything else is a 400 INVALID_REQUEST.
const ROUTE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/;
function stubRoutes() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    calls.push(input);
    const match = /^\/api\/places\/([^/]+)\/(profile|media)$/.exec(input);
    if (!match) throw new Error(`unexpected ${input}`);
    const id = decodeURIComponent(match[1]);
    if (!ROUTE_ID.test(id)) {
      return { ok: false, status: 400, json: async () => ({ code: "INVALID_REQUEST" }) } as Response;
    }
    const body = match[2] === "profile" ? { status: "unpublished", placeId: id } : { media: [] };
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
  return calls;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  runtime.states = []; runtime.effects = []; runtime.pending = []; runtime.idx = 0;
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });


describe("published-1 follow-ups: backoff and hidden tabs", () => {
  it("backs off after repeated failures instead of re-reading every 20 s", async () => {
    const { PLACES } = await import("@/lib/data");
    const salon = PLACES.find((p) => ROUTE_ID.test(p.id) && p.type === "hair_salon")!;
    const calls: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => { calls.push(Date.now()); return { ok: false, status: 503, json: async () => ({}) } as Response; }));
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    renderOnce(usePublishedPlace, salon);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    console.log(`503 for 10 min: ${calls.length} requests`);
    expect(calls.length).toBeLessThanOrEqual(14); // 20 s, 40 s, 80 s, 160 s, then 5 min — not 60 requests
  });

  it("does not re-read while the page is hidden, and re-reads once it is visible again", async () => {
    const calls = stubRoutes();
    const listeners = new Set<() => void>();
    const doc = { visibilityState: "visible", addEventListener: (_: string, l: () => void) => listeners.add(l), removeEventListener: (_: string, l: () => void) => listeners.delete(l) };
    vi.stubGlobal("document", doc);
    const { PLACES } = await import("@/lib/data");
    const salon = PLACES.find((p) => ROUTE_ID.test(p.id) && p.type === "hair_salon")!;
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    renderOnce(usePublishedPlace, salon);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls.length).toBe(2);
    doc.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(calls.length).toBe(2); // nothing while hidden
    doc.visibilityState = "visible";
    listeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls.length).toBe(4); // one re-read on return
  });
});
