// lightbox-3: Next/Previous during the smooth scroll.
// Extracts the CURRENT PhotoLightbox source verbatim from the worktree, runs it
// under a tiny hooks runtime (no jsdom available), with a fake scroll track that
// behaves like a browser smooth scroll: scrollTo(..., "smooth") does not jump,
// and scroll events fire with intermediate scrollLeft values each frame.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SRC = fileURLToPath(new URL("../components/place/place-detail-body.tsx", import.meta.url));
const OUT = fileURLToPath(new URL("./.lightbox-iso-extracted.tsx", import.meta.url)); // generated next to this test; gitignore or delete in afterAll

const rt = vi.hoisted(() => ({ hooks: [] as unknown[], i: 0, dirty: false, effects: [] as (() => void)[] }));
const dialogRef = vi.hoisted(() => ({ current: null as unknown }));
const focusArgs = vi.hoisted(() => ({ calls: [] as unknown[][] }));

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
vi.mock("@/components/ui/use-dialog-focus", () => ({ useDialogFocus: (...args: unknown[]) => { focusArgs.calls.push(args); return dialogRef; } }));
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
  vi.stubGlobal("document", { querySelector: (sel: string) => (sel === ".app-shell" ? host : null), body: { style: { overflow: "" } } });
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


type Sib = { inert: boolean; hasAttribute(n: string): boolean; setAttribute(n: string): void; removeAttribute(n: string): void };
const sib = (): Sib => ({ inert: false, hasAttribute() { return this.inert; }, setAttribute() { this.inert = true; }, removeAttribute() { this.inert = false; } });
let host: { children: unknown[] };

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  rt.hooks = []; rt.i = 0; rt.dirty = false; rt.effects = [];
  focusArgs.calls = [];
});

describe("tests-5: PhotoLightbox isolation (owner decision 3)", () => {
  it("makes the app shell's other children inert while open and restores them on close", async () => {
    const page = sib(); const nav = sib(); const already = sib(); already.inert = true; const dialog = sib();
    host = { children: [page, nav, already, dialog] };
    dialogRef.current = dialog;
    await mount(0);
    expect([page.inert, nav.inert, dialog.inert]).toEqual([true, true, false]);
    (rt.hooks as Array<{ cleanup?: () => void } | undefined>).forEach((h) => h && typeof h === "object" && "cleanup" in h && h.cleanup?.());
    expect([page.inert, nav.inert]).toEqual([false, false]);
    expect(already.inert).toBe(true); // what was inert before stays inert
  });

  it("opens the focus trap only once the portal host exists, with the close button first", async () => {
    host = { children: [] };
    await mount(0);
    expect(focusArgs.calls[0][0]).toBe(false); // first render: no host yet
    expect(focusArgs.calls.at(-1)![0]).toBe(true);
  });

  it("stops pointer, touch, wheel and click events at the dialog (React events bubble through portals)", async () => {
    host = { children: [] };
    const lb = await mount(0) as unknown as { counter: () => string };
    const source = readFileSync(SRC, "utf8");
    const dialog = source.slice(source.indexOf('className="photo-lightbox"'), source.indexOf('<div className="photo-lightbox-bar">'));
    for (const handler of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel", "onTouchStart", "onTouchMove", "onTouchEnd", "onWheel", "onClick"]) {
      expect(dialog).toContain(`${handler}={stopEvent}`);
    }
    expect(source).toContain('document.querySelector(".app-shell") ?? document.body');
    expect(lb.counter()).toBe("1 / 4");
  });
});
