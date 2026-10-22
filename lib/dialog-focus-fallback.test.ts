import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive useDialogFocus's effect directly: useRef returns a box, useEffect runs
// the effect now and records its cleanup so we can "unmount" the dialog.
const cleanups: Array<() => void> = [];
vi.mock("react", () => ({
  useRef: (v: unknown) => ({ current: v }),
  useEffect: (fn: () => void | (() => void)) => { const c = fn(); if (typeof c === "function") cleanups.push(c); },
}));

class FakeEl {
  isConnected = true;
  tabIndex = 0;
  constructor(public name: string) {}
  focus() {
    // Browser semantics: focus() on an element that is not connected / not
    // being rendered is a no-op and document.activeElement stays <body>.
    if (this.isConnected) doc.activeElement = this;
  }
  querySelectorAll() { return []; }
  contains() { return false; }
  matches() { return false; }
  closest() { return null; }
}
const body = new FakeEl("BODY");
const doc: { activeElement: FakeEl; addEventListener: () => void; removeEventListener: () => void } = {
  activeElement: body, addEventListener() {}, removeEventListener() {},
};

beforeEach(() => {
  vi.resetModules();
  cleanups.length = 0;
  vi.stubGlobal("HTMLElement", FakeEl);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { cb(); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("lightbox-2: focus after the opener tile is unmounted while the gallery is open", () => {
  it("control: closing normally returns focus to the opener tile", async () => {
    const { useDialogFocus } = await import("@/components/ui/use-dialog-focus");
    const tile = new FakeEl("photo-tile");
    doc.activeElement = tile;
    const closeBtn = new FakeEl("close");
    useDialogFocus(true, () => {}, { current: closeBtn as unknown as HTMLElement });
    expect(doc.activeElement.name).toBe("close");
    cleanups.forEach((c) => c());
    expect(doc.activeElement.name).toBe("photo-tile");
  });

  it("photos switched off (or tile re-keyed): focus must land on a connected element, not <body>", async () => {
    const { useDialogFocus } = await import("@/components/ui/use-dialog-focus");
    const tile = new FakeEl("photo-tile");
    doc.activeElement = tile;
    const closeBtn = new FakeEl("close");
    const title = new FakeEl("place-title");
    useDialogFocus(true, () => {}, { current: closeBtn as unknown as HTMLElement }, { current: title as unknown as HTMLElement });
    expect(doc.activeElement.name).toBe("close");
    // place-detail-body.tsx:988-1019: showPhotos=false swaps the hero to
    // .place-hero-chrome (tiles removed) and unmounts PhotoLightbox in the same
    // commit; the close button goes with it, so focus falls to <body>.
    tile.isConnected = false;
    closeBtn.isConnected = false;
    doc.activeElement = body;
    cleanups.forEach((c) => c());
    expect(doc.activeElement.name).toBe("place-title");
  });
});
