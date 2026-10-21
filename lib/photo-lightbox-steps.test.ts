// lightbox-3: Next/Previous during the smooth scroll.
// Extracts the CURRENT PhotoLightbox source verbatim from the worktree, runs it
// under a tiny hooks runtime (no jsdom available), with a fake scroll track that
// behaves like a browser smooth scroll: scrollTo(..., "smooth") does not jump,
// and scroll events fire with intermediate scrollLeft values each frame.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SRC = fileURLToPath(new URL("../components/place/place-detail-body.tsx", import.meta.url));
const OUT = fileURLToPath(new URL("./.lightbox-3-extracted.tsx", import.meta.url)); // generated next to this test; gitignore or delete in afterAll

const rt = vi.hoisted(() => ({ hooks: [] as unknown[], i: 0, dirty: false, effects: [] as (() => void)[] }));
const dialogRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return {
    ...actual,
    useState(init: unknown) {
      const i = rt.i++;
      if (!(i in rt.hooks)) rt.hooks[i] = typeof init === "function" ? (init as () => unknown)() : init;
      const set = (v: unknown) => {
        const nv = typeof v === "function" ? (v as (p: unknown) => unknown)(rt.hooks[i]) : v;
        if (!Object.is(nv, rt.hooks[i])) { rt.hooks[i] = nv; rt.dirty = true; }
      };
      return [rt.hooks[i], set];
    },
    useRef(init: unknown) {
      const i = rt.i++;
      if (!(i in rt.hooks)) rt.hooks[i] = { current: init };
      return rt.hooks[i];
    },
    useEffect(fn: () => void | (() => void), deps?: unknown[]) {
      const i = rt.i++;
      const prev = rt.hooks[i] as { deps?: unknown[]; cleanup?: () => void } | undefined;
      if (!prev || !deps || deps.some((d, k) => !Object.is(d, prev.deps?.[k]))) {
        rt.effects.push(() => { prev?.cleanup?.(); const c = fn(); rt.hooks[i] = { deps, cleanup: c ?? undefined }; });
      }
    },
  };
});
vi.mock("react-dom", () => ({ createPortal: (children: unknown) => children }));
vi.mock("@/components/ui/use-dialog-focus", () => ({ useDialogFocus: () => dialogRef }));
vi.mock("@/components/ui/icon-button", () => ({ IconButton: (p: unknown) => p }));

type El = { type: unknown; props: Record<string, unknown> } | null;
function walk(node: unknown, visit: (el: { type: unknown; props: Record<string, any> }) => void) {
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  const el = node as { type: unknown; props: Record<string, any> };
  if (!("props" in el)) return;
  visit(el);
  walk(el.props.children, visit);
}

function setup(startIndex: number, width = 390) {
  const source = readFileSync(SRC, "utf8");
  const start = source.indexOf("function PhotoLightbox(");
  const end = source.indexOf("// ── Public traveler reviews");
  if (start < 0 || end < 0) throw new Error("PhotoLightbox not found");
  writeFileSync(OUT, [
    'import { useEffect, useRef, useState, type RefObject } from "react";',
    'import { createPortal } from "react-dom";',
    'import { IconButton } from "@/components/ui/icon-button";',
    'import { useDialogFocus } from "@/components/ui/use-dialog-focus";',
    "export " + source.slice(start, end),
  ].join("\n"));

  const scrollCalls: { left: number; behavior?: string }[] = [];
  const track = {
    clientWidth: width,
    scrollLeft: 0,
    scrollTo(opts: { left: number; behavior?: string }) {
      scrollCalls.push(opts);
      if (opts.behavior !== "smooth") this.scrollLeft = opts.left; // instant
    },
  };
  vi.stubGlobal("document", { querySelector: () => ({ children: [] }), body: { style: { overflow: "" } } });
  return { track, scrollCalls };
}

async function mount(startIndex: number, width = 390) {
  const { track, scrollCalls } = setup(startIndex, width);
  const { PhotoLightbox } = (await import(OUT)) as { PhotoLightbox: (p: unknown) => unknown };
  const props = { photos: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"], index: startIndex, placeName: "Cafe", onClose() {} };
  let tree: unknown = null;
  const render = () => {
    do {
      rt.dirty = false; rt.i = 0;
      tree = PhotoLightbox(props);
      walk(tree, (el) => { if (el.props.className === "photo-lightbox-track" && el.props.ref) (el.props.ref as { current: unknown }).current = track; });
      rt.effects.splice(0).forEach((f) => f());
    } while (rt.dirty);
  };
  render();
  const find = (pred: (p: Record<string, any>) => boolean) => {
    let hit: Record<string, any> | null = null;
    walk(tree, (el) => { if (!hit && pred(el.props)) hit = el.props; });
    if (!hit) throw new Error("element not found");
    return hit as Record<string, any>;
  };
  const counter = () => { const c = find((p) => p["aria-live"] === "polite").children; return (Array.isArray(c) ? c : [c]).join(""); };
  const next = () => { find((p) => p.label === "Next photo").onClick(); render(); };
  const arrowRight = () => { find((p) => p.role === "dialog").onKeyDown({ key: "ArrowRight", preventDefault() {} }); render(); };
  // One animation frame of the browser's smooth scroll: scrollLeft moves, a scroll event fires.
  const frame = (left: number) => { track.scrollLeft = left; find((p) => p.className === "photo-lightbox-track").onScroll({ currentTarget: track }); render(); };
  return { counter, next, arrowRight, frame, scrollCalls, track };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  rt.hooks = []; rt.i = 0; rt.dirty = false; rt.effects = [];
});

describe("lightbox-3: Next/Previous during the smooth scroll", () => {
  it("control: opening at photo 1 shows 1 / 4 and scrolls instantly to 0", async () => {
    const lb = await mount(0);
    expect(lb.counter()).toBe("1 / 4");
    expect(lb.scrollCalls[0]).toEqual({ left: 0 });
  });

  it("the counter stays on the new photo while the smooth scroll is still before the midpoint", async () => {
    const lb = await mount(0);
    lb.next();
    expect(lb.scrollCalls.at(-1)).toEqual({ left: 390, behavior: "smooth" });
    const seen = [lb.counter()];
    for (const left of [2, 12, 34, 83, 164, 228, 390]) { lb.frame(left); seen.push(lb.counter()); }
    console.log("counter timeline after one Next:", seen.join(" -> "));
    expect(seen.every((c) => c === "2 / 4")).toBe(true);
  });

  it("two Next taps 50ms apart (second before the midpoint) end on photo 3", async () => {
    const lb = await mount(0);
    lb.next();
    lb.frame(12); lb.frame(34); // ~50ms into the first smooth scroll
    lb.next();
    console.log("scrollTo calls:", JSON.stringify(lb.scrollCalls), "counter:", lb.counter());
    expect(lb.scrollCalls.at(-1)).toEqual({ left: 780, behavior: "smooth" });
    expect(lb.counter()).toBe("3 / 4");
  });

  it("three ArrowRight key repeats 33ms apart end on photo 4", async () => {
    const lb = await mount(0);
    lb.arrowRight(); lb.frame(12);
    lb.arrowRight(); lb.frame(40);
    lb.arrowRight();
    const target = lb.scrollCalls.at(-1)!.left; // the browser finishes the scroll it was last asked for
    for (const f of [0.3, 0.6, 0.9, 1]) lb.frame(40 + (target - 40) * f);
    console.log("scrollTo calls:", JSON.stringify(lb.scrollCalls), "counter:", lb.counter());
    expect(lb.scrollCalls.at(-1)).toEqual({ left: 1170, behavior: "smooth" });
    expect(lb.counter()).toBe("4 / 4");
  });
});
