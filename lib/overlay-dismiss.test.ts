import { describe, expect, it } from "vitest";
import { EXIT_MS, nextExitState, type ExitState } from "./overlay-dismiss";

/** R6: every sheet, modal and drawer animated in and was then cut from the
 *  DOM in a single frame (measured: 300ms in, 49.8ms out). The fix keeps the
 *  node mounted for the exit animation — but the unmount must be driven by a
 *  timer, never by `animationend`: the global reduced-motion block sets
 *  `animation: none !important`, so that event would never fire and the
 *  overlay would never close. */
describe("nextExitState", () => {
  const step = (prev: ExitState, open: boolean, reduced = false) => nextExitState(prev, open, reduced);

  it("opens immediately", () => {
    expect(step("closed", true)).toBe("open");
    expect(step("closing", true)).toBe("open");
  });

  it("plays the exit animation when an open overlay is dismissed", () => {
    expect(step("open", false)).toBe("closing");
  });

  it("closes at once under reduced motion, where no animation will ever run", () => {
    expect(step("open", false, true)).toBe("closed");
  });

  it("never animates out something that was never open", () => {
    expect(step("closed", false)).toBe("closed");
    expect(step("closed", false, true)).toBe("closed");
  });

  it("stays closing while the timer runs rather than restarting it", () => {
    expect(step("closing", false)).toBe("closing");
  });

  it("uses an exit duration shorter than a typical enter, per Material 3", () => {
    // emphasized accelerate: 200ms — exits should feel quicker than entrances
    expect(EXIT_MS).toBeLessThanOrEqual(200);
    expect(EXIT_MS).toBeGreaterThan(0);
  });
});

describe("exit animation wiring", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the hook never waits on animationend, which reduced motion would silence", () => {
    const hook = read("components/ui/use-exit-transition.ts");
    // the listener, not the word — the comment explains why it is avoided
    expect(hook).not.toMatch(/addEventListener\(\s*["']animationend/);
    expect(hook).toMatch(/setTimeout/);
    // read in an effect, not during render, or SSR and client disagree
    expect(hook).toMatch(/useEffect\([\s\S]*matchMedia/);
  });

  it("self-owned overlays stay mounted while closing", () => {
    for (const path of ["components/ui/signout-modal.tsx", "components/ui/hamburger-menu.tsx"]) {
      const src = read(path);
      expect(src, path).toMatch(/useExitTransition\(open\)/);
      expect(src, path).toMatch(/closing \? /);
    }
  });

  it("a closing scrim stops swallowing taps meant for the page underneath", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.drawer-scrim\.closing[^{]*\{[^}]*pointer-events:\s*none/);
  });

  it("scrims fade without the 6px sideways slide that `fade` was written for", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/@keyframes scrim-in/);
    expect(css).not.toMatch(/\.overlay\s*\{[^}]*animation:\s*fade/);
  });
});
