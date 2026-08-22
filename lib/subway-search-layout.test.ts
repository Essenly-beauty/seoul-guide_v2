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

  it("aligns endpoint markers with their station value rows", () => {
    expect(cssSource).toMatch(
      /\.subway-search-field-stack \.station-combobox\s*\{[^}]*min-height:\s*72px;[^}]*padding:\s*6px 0;/,
    );
    expect(cssSource).toMatch(
      /\.subway-search-field-stack \.station-combobox > label\s*\{[^}]*line-height:\s*16px;/,
    );
    expect(cssSource).toMatch(
      /\.subway-search-route-rail\s*\{[^}]*padding:\s*34px 0 18px;/,
    );
    expect(cssSource).toMatch(
      /\.subway-route-dot\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;/,
    );
    expect(cssSource).toContain(".subway-route-dot:not(.line)::before");
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
    // Result rows grew to 64px/15.5px on 2026-08-02 — the list read too small.
    expect(cssSource).toMatch(
      /\.station-result-options > button\s*\{[^}]*min-height:\s*64px;[^}]*gap:\s*9px;/,
    );
    expect(cssSource).toMatch(
      /\.station-linebadge\s*\{[^}]*min-width:\s*20px;[^}]*height:\s*20px;/,
    );
    expect(cssSource).toMatch(/\.station-result-name b\s*\{[^}]*font-size:\s*15\.5px;/);
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

describe("station-first browse (phase 1)", () => {
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
  const mapScreen = readFileSync(new URL("../components/map/map-screen.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("leads with the nearby list and collapses the route form", () => {
    expect(controller).toContain("station-sheet");
    expect(controller).toContain("Plan a route from {stationDisplayName(activeStation)}");
    // the whole list, not the old three-item teaser
    expect(controller).toContain("{rankedPlaces.map(({ place, km }) => (");
  });

  it("keeps the map on screen while browsing a station", () => {
    expect(controller).toContain('" station-browse"');
    expect(css).toContain(".subway-controller.station-browse");
    expect(css).toContain(".station-sheet-filters");
    // the editor's full-screen rule must not apply to the browse state
    expect(css).toContain(":has(.subway-controller.station-browse) .map-top");
  });

  it("never shows a disabled primary CTA during browse", () => {
    expect(controller).toContain("{(editing || !route) && routeFormOpen && (");
  });

  it("tapping a station disc browses instead of presetting a route leg", () => {
    const handler = mapScreen.slice(mapScreen.indexOf("onStationClick={"), mapScreen.indexOf("onStationClick={") + 600);
    expect(handler).toContain("setActiveStation(id)");
    expect(handler).not.toContain("setDeparture(id)");
  });

  it("accepts the station deep link that search results emit", () => {
    expect(mapScreen).toContain('searchParams.get("station")');
    expect(readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8")).toContain("mode=subway&station=");
  });
});

describe("plan-a-route carries the browsed station", () => {
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");

  it("names the station on the button and seeds it as the departure", () => {
    // "Plan a route from here" that opens a blank form makes the visitor
    // retype the station they were just looking at.
    expect(controller).toContain("Plan a route from {stationDisplayName(activeStation)}");
    expect(controller).toContain("if (!draftDeparture) setDraftDeparture(activeStation.id)");
  });
});

describe("route-ready panel shares the station-sheet language", () => {
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("dropped the stacked radius control and category tab row", () => {
    // these two stacked rows (56px + 48px) were most of why the shop list sat
    // at the screen edge once a route existed
    expect(controller).not.toContain("subway-segmented");
    expect(controller).not.toContain("subway-category-tabs");
    // the rail now lives on the map, not in the panel
    expect(controller).not.toContain("station-sheet-filters");
  });

  it("uses the same thumbnail rows as the browse sheet", () => {
    expect(controller).toContain("station-row-thumb");
    expect(controller).not.toContain("subway-place-copy");
  });

  it("never prints a live-arrivals claim", () => {
    // there is no arrivals feed; the hand-off is labelled for what it does
    expect(controller).not.toContain("> Live\n");
    // and no fabricated duration either — our graph arithmetic has no live
    // schedule behind it, so Google owns timing
    expect(controller).not.toContain("travelMinutes(readyRoute)");
    expect(controller).toContain("Times &amp; platforms in Google Maps");
  });

  it("states the route once, not three times", () => {
    // header title + ticket card + stepper all repeated the same endpoints
    expect(controller).toContain("{!readyRoute && (");
    expect(css).toContain(".subway-controller.route-ready.snap-half { height: min(62%, 580px); }");
  });
});

describe("subway flow: search → station → place (owner walkthrough 2026-08-22)", () => {
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
  const mapScreen = readFileSync(new URL("../components/map/map-screen.tsx", import.meta.url), "utf8");

  it("a place tapped in the station list opens the place card", () => {
    // MapSheet only mounts in map mode, so staying in subway mode left the
    // tap with nothing to show but a highlighted pin
    const handler = mapScreen.slice(mapScreen.indexOf("onPlace={"), mapScreen.indexOf("onPlace={") + 420);
    expect(handler).toContain("handleMapSelect(id)");
    expect(handler).toContain('setMode("map")');
  });

  it("the subway context pill leads back to search", () => {
    // it used to be an inert <div> naming the station
    expect(mapScreen).toContain('className="map-searchpill subway-map-context"');
    const pill = mapScreen.slice(mapScreen.indexOf("subway-map-context") - 400, mapScreen.indexOf("subway-map-context") + 400);
    expect(pill).toContain("href={routes.search}");
  });

  it("station results lead with the name and trail the line badges", () => {
    const row = controller.slice(controller.indexOf('role="option"'), controller.indexOf('role="option"') + 1400);
    expect(row.indexOf("station-result-name")).toBeLessThan(row.indexOf("<StationLineBadges"));
  });
});

describe("subway panel layout defects (owner reports 2026-08-22)", () => {
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("does not bleed rows past a scroller that has no horizontal padding", () => {
    // margin-inline: -18px pushed every row 18px past both edges of
    // .subway-controller-scroll, which pads only the bottom
    expect(css).toContain(".subway-controller.route-ready .station-row { margin-inline: 0; }");
    expect(css).toContain("overflow-x: hidden");
  });

  it("keeps the filter popover out of a clipping scroll container", () => {
    // an overflow container clips absolutely positioned descendants, which
    // sliced the radius popover in half
    const rail = readFileSync(new URL("../components/subway/station-filter-rail.tsx", import.meta.url), "utf8");
    expect(css).not.toMatch(/\.station-filter-rail \{[^}]*overflow-x: auto/);
    expect(css).toContain(".station-sheet-cats {");
    expect(rail).toContain('className="station-sheet-cats"');
  });

  it("gives the station picker real height instead of a 230px box", () => {
    expect(css).toContain("max-height: clamp(240px, calc(78dvh - 225px), 520px)");
  });

  it("does not put route editing inside the shop list", () => {
    // the only surviving mention is the comment recording why it left
    expect(controller).not.toContain("canAddActiveVia");
    expect(controller).not.toContain('className="subway-via-add inline"');
  });

  it("pluralises the place count", () => {
    expect(controller).toContain('rankedPlaces.length === 1 ? "place" : "places"');
  });
});

describe("filters live on the map, panel is for results (2026-08-22)", () => {
  const mapScreen = readFileSync(new URL("../components/map/map-screen.tsx", import.meta.url), "utf8");
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("renders the filter rail with the map chrome", () => {
    expect(mapScreen).toContain("<StationFilterRail");
    expect(controller).not.toContain("StationFilterRail");
  });

  it("hides the tab bar in subway mode", () => {
    // it offered nothing mid-browse and clipped the panel
    expect(css).toContain("body:has(.map-screen.subway-mode) .bottomnav { display: none; }");
  });

  it("drops the header row once the ticket card carries Edit and close", () => {
    expect(controller).toContain("{!readyRoute && !browsingStation && (");
    const meta = controller.slice(controller.indexOf('className="subway-ticket-meta"'), controller.indexOf('className="subway-ticket-meta"') + 2600);
    expect(meta).toContain("subway-text-action");
    expect(meta).toContain("Close subway planner");
  });
});

describe("timing is Google's job, the stepper is the bottom control", () => {
  const controller = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
  const geo = readFileSync(new URL("../lib/geo.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("hands Google the whole trip, not just the endpoints", () => {
    expect(geo).toContain("waypoints?: LatLng[]");
    expect(controller).toContain("viaIds.map((id) => STATIONS[id]).filter(Boolean)");
  });

  it("pins the station stepper to the bottom instead of scrolling it away", () => {
    expect(controller).toContain('className="subway-station-focus pinned"');
    expect(css).toContain(".subway-station-focus.pinned {");
    expect(css).toContain("bottom: 0;");
  });
});
