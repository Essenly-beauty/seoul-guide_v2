import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autoRequestAllowed, readGeolocationPermission } from "./geolocation-policy";

/** web.dev "Web permissions best practices": a location prompt fired on page
 *  load is accepted ~12% of the time, one fired from a user gesture ~30%; Apple
 *  HIG and Android both say to ask in context. The map may therefore only
 *  call getCurrentPosition on load when the permission is ALREADY granted
 *  (no prompt can appear); otherwise it waits for the locate button. */
describe("readGeolocationPermission", () => {
  const nav = (query?: (d: { name: string }) => Promise<{ state: string }>) =>
    ({ permissions: query ? { query } : undefined }) as unknown as Navigator;

  it("reports the Permissions API state for geolocation", async () => {
    let asked = "";
    const n = nav(async (d) => { asked = d.name; return { state: "granted" }; });
    expect(await readGeolocationPermission(n)).toBe("granted");
    expect(asked).toBe("geolocation");
  });

  it("maps prompt and denied through unchanged", async () => {
    expect(await readGeolocationPermission(nav(async () => ({ state: "prompt" })))).toBe("prompt");
    expect(await readGeolocationPermission(nav(async () => ({ state: "denied" })))).toBe("denied");
  });

  it("is 'unsupported' when the Permissions API is missing or rejects (older Safari)", async () => {
    expect(await readGeolocationPermission(nav())).toBe("unsupported");
    expect(await readGeolocationPermission(nav(async () => { throw new TypeError("nope"); }))).toBe("unsupported");
    expect(await readGeolocationPermission(undefined)).toBe("unsupported");
  });
});

describe("autoRequestAllowed", () => {
  it("allows a silent request only when already granted", () => {
    expect(autoRequestAllowed("granted")).toBe(true);
    for (const s of ["prompt", "denied", "unsupported"] as const) expect(autoRequestAllowed(s)).toBe(false);
  });
});

describe("useLocation wiring", () => {
  it("no longer requests the position unconditionally on mount", () => {
    const src = readFileSync(join(process.cwd(), "components/map/use-location.ts"), "utf8");
    expect(src).not.toMatch(/useEffect\(\(\) => \{ request\(\); \}/);
    expect(src).toMatch(/readGeolocationPermission/);
    expect(src).toMatch(/autoRequestAllowed/);
  });
});
