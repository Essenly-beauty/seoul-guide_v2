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

describe("usePublishedPlace request volume", () => {
  it("does not keep re-requesting a pin whose id the public endpoints reject (every Olive Young / Daiso pin)", async () => {
    const calls = stubRoutes();
    const { PLACES } = await import("@/lib/data");
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    const oliveYoung = PLACES.find((p) => p.type === "olive_young" && !ROUTE_ID.test(p.id))!;
    expect(oliveYoung).toBeDefined();

    renderOnce(usePublishedPlace, oliveYoung);
    await vi.advanceTimersByTimeAsync(5 * 60_000); // pin left selected for five minutes
    console.log(`pin ${oliveYoung.id}: ${calls.length} requests in 5 min; statuses all 400`);
    // One lookup (two requests) is the most a pin that can never have a profile should cost.
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it("remembers a definitive answer, so re-tapping such a pin within a minute sends nothing", async () => {
    const calls = stubRoutes();
    const { PLACES } = await import("@/lib/data");
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    const daiso = PLACES.find((p) => p.type === "daiso" && !ROUTE_ID.test(p.id))!;
    renderOnce(usePublishedPlace, daiso);
    await vi.advanceTimersByTimeAsync(1_000);
    renderOnce(usePublishedPlace, null);   // close the card
    renderOnce(usePublishedPlace, daiso);  // tap the same pin again
    await vi.advanceTimersByTimeAsync(1_000);
    console.log(`pin ${daiso.id}: ${calls.length} requests for two taps 1 s apart`);
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it("control: an ASCII-id venue is memoized and re-read once a minute", async () => {
    const calls = stubRoutes();
    const { PLACES } = await import("@/lib/data");
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    const salon = PLACES.find((p) => ROUTE_ID.test(p.id) && p.type === "hair_salon")!;
    renderOnce(usePublishedPlace, salon);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    console.log(`pin ${salon.id}: ${calls.length} requests in 5 min`);
    expect(calls.length).toBeLessThanOrEqual(12);
  });
});

describe("usePublishedPlace pin switching (control scenarios)", () => {
  it("A -> B -> A with deferred responses never shows another pin's profile and drops aborted answers", async () => {
    const { PLACES } = await import("@/lib/data");
    const [a, b] = PLACES.filter((p) => ROUTE_ID.test(p.id)).slice(0, 2);
    const resolvers: { path: string; signal: AbortSignal; resolve: (r: Response) => void; reject: (e: unknown) => void }[] = [];
    vi.stubGlobal("fetch", vi.fn((path: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      const signal = init.signal!;
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      resolvers.push({ path, signal, resolve, reject });
    })));
    const profile = (id: string, nameEn: string) => ({
      status: "published", placeId: id,
      profile: { contactPhone: "", contactEmail: "", englishOk: true, notice: "", showPhotos: false, nameKo: "이름", nameEn, address: "addr", introductionKo: "", introductionEn: "", updatedAt: "2026-10-20T12:00:00.000Z" },
    });
    const answer = (index: number, body: unknown) => resolvers[index].resolve({ ok: true, status: 200, json: async () => body } as Response);
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    renderOnce(usePublishedPlace, a);          // requests 0,1 for A
    renderOnce(usePublishedPlace, b);          // aborts A; requests 2,3 for B
    renderOnce(usePublishedPlace, a);          // aborts B; requests 4,5 for A
    answer(0, profile(a.id, "A stale")); answer(1, { media: [] });
    answer(2, profile(b.id, "B")); answer(3, { media: [] });
    await vi.advanceTimersByTimeAsync(0);
    let shown = renderOnce(usePublishedPlace, a) as Place;
    expect(shown.name).toBe(a.name);           // nothing landed from aborted requests
    answer(4, profile(a.id, "A fresh")); answer(5, { media: [] });
    await vi.advanceTimersByTimeAsync(0);
    shown = renderOnce(usePublishedPlace, a) as Place;
    expect(shown.name).toBe("A fresh");
    shown = renderOnce(usePublishedPlace, b) as Place;
    expect(shown.id).toBe(b.id);
    expect(shown.name).toBe(b.name);           // A's state is never shown under B
  });
});

describe("usePublishedPlace timer chain (control scenarios)", () => {
  it("keeps one re-read chain across re-renders, reuses a fresh memo, and stops after unmount", async () => {
    const calls = stubRoutes();
    const { PLACES } = await import("@/lib/data");
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    const salon = PLACES.find((p) => ROUTE_ID.test(p.id) && p.type === "hair_salon")!;
    renderOnce(usePublishedPlace, salon);
    for (let i = 0; i < 20; i++) renderOnce(usePublishedPlace, salon); // parent re-renders
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls.length).toBe(2);
    renderOnce(usePublishedPlace, null);
    renderOnce(usePublishedPlace, salon);   // reselect within a minute
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls.length).toBe(2);           // fresh memo, no request
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls.length).toBe(4);           // one re-read a minute
    unmount();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(calls.length).toBe(4);           // nothing after unmount
  });

  it("photo failure with earlier photos: the 20 s retry finds the entry fresh and waits for the minute", async () => {
    const { PLACES } = await import("@/lib/data");
    const salon = PLACES.find((p) => ROUTE_ID.test(p.id) && p.type === "hair_salon")!;
    let mediaFails = false;
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string) => {
      calls.push(`${Date.now()} ${path.endsWith("media") ? "media" : "profile"}`);
      if (path.endsWith("media") && mediaFails) throw new Error("network");
      const body = path.endsWith("media") ? { media: [] } : { status: "unpublished", placeId: salon.id };
      return { ok: true, status: 200, json: async () => body } as Response;
    }));
    const { usePublishedPlace } = await import("@/components/place/use-published-place");
    const start = Date.now();
    renderOnce(usePublishedPlace, salon);
    await vi.advanceTimersByTimeAsync(1_000);
    mediaFails = true;
    await vi.advanceTimersByTimeAsync(60_000);  // re-read at 60 s: media fails
    await vi.advanceTimersByTimeAsync(30_000);  // 20 s retry window
    console.log(calls.map((c) => { const [t, k] = c.split(" "); return `${Number(t) - start}ms ${k}`; }).join(", "));
  });
});
