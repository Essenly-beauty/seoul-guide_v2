import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-10-22 production check: with a route-level loading.tsx, Next streams a
// skeleton first and the page body later. When that body lands while React is
// still hydrating the shell, React 19.2 under Next 15.5 intermittently fails
// hydration (#418), re-renders the whole page on the client, and the streamed
// boundary script throws "Cannot read properties of null (reading 'parentNode')".
// On the production build, opening one place page after another hit it in 18 of
// 60 runs with app/loading.tsx and 0 of 60 without it. Loading states belong
// inside client components (components/ui/skeleton.tsx) instead.
const loadingFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return loadingFiles(path);
    return /^loading\.(tsx|ts|jsx|js)$/.test(name) ? [path] : [];
  });

describe("route loading boundaries", () => {
  it("has no route-level loading file, so no page streams its body after a skeleton", () => {
    expect(loadingFiles(join(process.cwd(), "app"))).toEqual([]);
  });
});
