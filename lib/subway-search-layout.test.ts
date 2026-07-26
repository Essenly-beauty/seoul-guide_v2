import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controllerSource = readFileSync(
  new URL("../components/subway/subway-route-controller.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const routeStripSource = readFileSync(
  new URL("../components/subway/route-strip.tsx", import.meta.url),
  "utf8",
);
const iconSource = readFileSync(new URL("../components/icon.tsx", import.meta.url), "utf8");

describe("subway endpoint search layout", () => {
  it("groups departure and arrival into a connected route field", () => {
    expect(controllerSource).toContain('className="subway-search-route-rail"');
    expect(controllerSource).toContain('className="subway-search-field-stack"');
  });

  it("styles visible endpoint dots and their connector", () => {
    expect(cssSource).toContain(".subway-search-route-rail");
    expect(cssSource).toContain(".subway-route-dot.departure");
    expect(cssSource).toContain(".subway-route-dot.arrival");
  });

  it("opens station suggestions below the connected fields at full width", () => {
    expect(cssSource).toContain(".subway-search-field-stack .station-search-results");
    expect(cssSource).toContain(".subway-search-fields:has(.station-search-results)");
  });

  it("uses one clear control and a placeholder that fits a mobile route field", () => {
    expect(controllerSource).toContain('placeholder="Search station"');
    expect(controllerSource).not.toContain("Station name in English or Korean");
    expect(controllerSource).toContain("{query && open && (");
    expect(cssSource).toMatch(
      /\.station-search-input input::-webkit-search-cancel-button\s*\{[^}]*display:\s*none;/,
    );
  });

  it("keeps focused text inset and preserves a 44px input row", () => {
    expect(cssSource).toMatch(
      /\.subway-search-field-stack \.station-search-input\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*0 44px 0 12px;/,
    );
  });

  it("uses a quiet swap control with a smaller visual inside its 44px target", () => {
    expect(cssSource).toMatch(
      /\.subway-swap-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/,
    );
    expect(cssSource).toContain(".subway-swap-button::before");
    expect(cssSource).toMatch(
      /\.subway-swap-button::before\s*\{[^}]*inset:\s*5px;/,
    );
  });

  it("moves from a chosen arrival station to the route action without reopening results", () => {
    expect(controllerSource.match(/arrivalInputRef\.current\?\.focus\(\)/g)).toHaveLength(1);
    expect(controllerSource).toContain("routeButtonRef.current?.focus()");
    expect(controllerSource).toContain("buttonRef={routeButtonRef}");
  });

  it("inserts via stations into the connected field and exposes explicit order controls", () => {
    expect(controllerSource).toContain('className="subway-waypoint-row"');
    expect(controllerSource).toContain('aria-label={`Via ${index + 1}:');
    expect(controllerSource).toContain("moveDraftWaypoint(index + 1, -1)");
    expect(controllerSource).toContain("moveDraftWaypoint(index + 1, 1)");
    expect(controllerSource).not.toContain('className="subway-via-chip"');
  });

  it("stacks via order controls below the station name on very narrow screens", () => {
    expect(cssSource).toContain(".subway-waypoint-row:not(.adding)");
    expect(cssSource).toMatch(
      /\.subway-waypoint-row:not\(\.adding\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });

  it("tracks repeated route stations by occurrence index instead of station id", () => {
    expect(controllerSource).toContain("activeRouteIndex");
    expect(controllerSource).not.toContain("readyRoute.stations.indexOf(activeId)");
    expect(routeStripSource).toContain("activeIndex");
    expect(routeStripSource).toContain("absoluteIndex");
    expect(routeStripSource).toContain('key={`${id}-${absoluteIndex}`}');
    expect(routeStripSource).not.toContain("key={id}");
  });

  it("keeps combobox suggestions out of the Tab sequence", () => {
    expect(controllerSource).toMatch(/role="option"\s+tabIndex=\{-1\}/);
  });

  it("uses compact line badges and quiet accessible context icons", () => {
    expect(cssSource).toMatch(
      /\.station-result-options > button\s*\{[^}]*min-height:\s*56px;[^}]*gap:\s*6px;/,
    );
    expect(cssSource).toMatch(
      /\.station-linebadge\s*\{[^}]*min-width:\s*20px;[^}]*height:\s*20px;/,
    );
    expect(cssSource).toMatch(/\.station-result-name b\s*\{[^}]*font-size:\s*14px;/);
    expect(cssSource).toMatch(/\.station-result-name > span\s*\{[^}]*font-size:\s*12px;/);
    expect(controllerSource).toContain('name={context === "Recent" ? "history" : "locate"}');
    expect(controllerSource).toContain('<span className="sr-only">{context}</span>');
    expect(iconSource).toContain('| "history"');
    expect(iconSource).toContain('id="i-history"');
  });

  it("restores focus and announces via changes when a focused row unmounts", () => {
    expect(controllerSource).toContain("pendingWaypointFocusRef");
    expect(controllerSource).toContain("waypointAnnouncement");
    expect(controllerSource).toContain('aria-live="polite"');
    expect(controllerSource).toContain("viaAddButtonRef");
  });

  it("simplifies the route summary before a 390px viewport can overflow", () => {
    expect(controllerSource).toContain('aria-label="Show nearby places"');
    expect(cssSource).toMatch(
      /@media \(max-width:\s*420px\)\s*\{[^}]*\.subway-route-summary > span:nth-of-type\(2\)/,
    );
    expect(cssSource).toContain(".subway-nearby-jump > span");
  });
});
