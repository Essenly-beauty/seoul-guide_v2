import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-10-22 production check: Next 15.5's bundled React (19.2 canary) can fail
// hydration (#418) when a host element's child is still waiting on a JS chunk.
// React pauses on the <div>, replays it once the chunk lands, and the replay
// does not move the hydration cursor back (fixed in React 19.3), so the <div>
// is compared with its own first child. The root layout's app-shell <div> held
// the route element directly and hit this in 2 of 160 production place-page
// loads. Handing the route over through RouteSlot, a client component that only
// returns its children, makes the paused fiber a function component, whose
// replay is safe: 0 of 150 throttled local runs, against 13 of 60 before.
// RouteSlot can go once the bundled React has the fix (Next 16 does).
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("route content hydration", () => {
  it("passes the route into app-shell through RouteSlot, never as a bare {children}", () => {
    const layout = read("app/layout.tsx");
    const shell = layout.slice(layout.indexOf('<div className="app-shell">'));
    const shellBody = shell.slice(0, shell.indexOf("</div>"));
    expect(shellBody).toContain("<RouteSlot>{children}</RouteSlot>");
    expect(shellBody.replace("<RouteSlot>{children}</RouteSlot>", "")).not.toContain("{children}");
  });

  it("keeps RouteSlot a client component that only returns its children", () => {
    const slot = read("components/system/route-slot.tsx");
    expect(slot.startsWith('"use client";')).toBe(true);
    expect(slot).toMatch(/return children;\s*\}\s*$/);
  });
});
