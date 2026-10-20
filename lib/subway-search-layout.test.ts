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
const pickerSource = readFileSync(new URL("../components/subway/station-search-field.tsx", import.meta.url), "utf8");
const pickerCss = readFileSync(new URL("../components/subway/station-search-field.module.css", import.meta.url), "utf8");

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

  it("opens a dedicated search screen above the map instead of an inline dropdown", () => {
    expect(controllerSource).toContain("<StationSearchField");
    expect(pickerSource).toContain("createPortal(");
    expect(pickerSource).toContain('role="dialog" aria-modal="true"');
    expect(pickerCss).toMatch(/\.page\s*\{[^}]*position: absolute;[^}]*inset: 0 0 var\(--kb, 0px\)/);
  });

  it("provides a labelled search input with a separate query clear action", () => {
    expect(pickerSource).toContain('placeholder={t("Search station")}');
    expect(pickerSource).toContain('label="Clear station search"');
    expect(pickerCss).toContain("::-webkit-search-cancel-button");
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
    expect(controllerSource.match(/arrivalButtonRef\.current\?\.focus\(\)/g)).toHaveLength(1);
    expect(controllerSource).toContain("routeButtonRef.current?.focus()");
    expect(controllerSource).toContain("buttonRef={routeButtonRef}");
  });

  it("opens an existing route editor without choosing an endpoint for the visitor", () => {
    const openEditor = controllerSource.slice(controllerSource.indexOf("const openEditor ="), controllerSource.indexOf("const cancelEditor ="));
    expect(openEditor).not.toContain('pendingFocusRef.current = "search"');
    expect(controllerSource).toContain('aria-label="Route endpoints"');
    expect(controllerSource).toContain("routeEditorRef.current?.focus()");
  });

  it("advances only after a selected result, not when dismissing search", () => {
    expect(controllerSource).toContain("if (id && advanceFocus && !draftArrival)");
    expect(controllerSource).toContain("if (id && advanceFocus && !arrivalId)");
    expect(pickerSource).toContain("onSelect(id, true)");
    expect(pickerSource).not.toContain("onBlur=");
  });

  it("uses shared Escape, focus trapping and a visible Back action", () => {
    expect(pickerSource).toContain("useDialogFocus<HTMLDivElement>(true, onClose, inputRef)");
    expect(pickerSource).toContain('name="back"');
    expect(pickerSource).toContain("onClick={onClose}");
  });

  it("keeps the selected endpoint separate from the editable query", () => {
    expect(pickerSource).toContain('onChange={(event) => setQuery(event.target.value)}');
    expect(pickerSource).toContain('setQuery(""); inputRef.current?.focus()');
    expect(pickerSource).not.toContain("onSelect(null)");
  });

  it("ignores Enter during Korean IME composition", () => {
    expect(pickerSource).toContain("event.nativeEvent.isComposing");
    expect(pickerSource).toContain("event.keyCode === 229");
  });

  it("provides explicit removal rather than clearing the endpoint as someone types", () => {
    expect(pickerSource).toContain("onClick={() => commit(null)}");
    expect(pickerSource).toContain('text="Remove station"');
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
    expect(pickerSource).toMatch(/role="option"\s+tabIndex=\{-1\}/);
  });

  it("shows English and Korean station names with readable line badges", () => {
    expect(pickerSource).toContain("{station.name}");
    expect(pickerSource).toContain('lang="ko">{station.nameKr}');
    expect(pickerSource).toContain("lineTextColor(LINE_META[line].color)");
    expect(pickerSource).toContain('role="group" aria-label={t(group.label)}');
  });

  it("restores focus and announces via changes when a focused row unmounts", () => {
    expect(controllerSource).toContain("pendingWaypointFocusRef");
    expect(controllerSource).toContain("waypointAnnouncement");
    expect(controllerSource).toContain('aria-live="polite"');
    expect(controllerSource).toContain("viaAddButtonRef");
  });

  it("keeps the route action row on one line at 390px", () => {
    expect(controllerSource).toContain('aria-label="Show nearby places"');
    // the row no longer sheds its labels at narrow widths — it lost the
    // duration pill and the transfer sentence, so the Google link ellipsises
    // instead of the buttons going wordless
    const meta = cssSource.slice(cssSource.indexOf(".subway-route-summary .subway-ticket-meta {"));
    expect(meta.slice(0, 320)).toContain("flex-wrap: nowrap");
    expect(cssSource).toContain(".subway-route-open");
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

  it("shows English primary and official Korean secondary names in both nearby-list variants", () => {
    expect(controller.match(/className="place-name-primary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(controller.match(/className="place-name-secondary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(controller.match(/\{place\.nameKr\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(controller.match(/lang="ko"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("never prints a live-arrivals claim", () => {
    // there is no arrivals feed; the hand-off is labelled for what it does
    expect(controller).not.toContain("> Live\n");
    // and no fabricated duration either — our graph arithmetic has no live
    // schedule behind it, so Google owns timing
    expect(controller).not.toContain("travelMinutes(readyRoute)");
    expect(controller).toContain("Open in Google Maps");
  });

  it("states the route once, not three times", () => {
    // header title + ticket card + stepper all repeated the same endpoints
    expect(controller).toContain("{!readyRoute && (");
    expect(css).toContain(".subway-controller.route-ready.snap-half { height: min(62%, 580px); }");
  });

  it("sizes the compact panel from its preview and station content, with a short-viewport scroll fallback", () => {
    const start = css.indexOf(".subway-controller.route-ready.snap-compact {");
    const compact = css.slice(start, css.indexOf("}", start));
    expect(compact).toContain("height: auto");
    expect(compact).toContain("overflow-y: auto");
    expect(css).toMatch(/\.subway-controller\.route-ready\.snap-compact \.subway-controller-scroll\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.subway-compact-station\s*\{[^}]*padding:[^;]*env\(safe-area-inset-bottom\)/);
  });

  it("uses the summary grid gap without adding another paragraph margin", () => {
    for (const className of ["subway-route-preview-label", "subway-route-preview-note"]) {
      const start = css.indexOf(`.${className} {`);
      const rule = css.slice(start, css.indexOf("}", start));
      expect(rule).toContain("margin: 0");
    }
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
    const start = pickerSource.indexOf('role="option"');
    const row = pickerSource.slice(start, pickerSource.indexOf("</button>", start));
    expect(row.indexOf("styles.name")).toBeLessThan(row.indexOf("styles.lines"));
  });
});

describe("station search preserves the route underneath", () => {
  it("uses a button launcher so restoring focus cannot reopen the search", () => {
    expect(pickerSource).toContain('aria-haspopup="dialog"');
    expect(pickerSource).toContain("onClick={() => setOpen(true)}");
    expect(pickerSource).not.toContain("onFocus={() => setOpen(true)}");
  });

  it("keeps route submission and swap actions in the planner", () => {
    expect(controllerSource).toContain('aria-label="Swap departure and arrival"');
    expect(controllerSource).toContain("onClick={applyRoute}");
    expect(pickerSource).not.toContain("applyRoute");
  });

  it("scrolls only the result body and leaves the search header visible", () => {
    expect(pickerCss).toMatch(/\.results\s*\{[^}]*min-height: 0;[^}]*overflow-y: auto/);
    expect(pickerCss).toMatch(/\.header\s*\{[^}]*flex: none/);
  });
});

describe("station sheet: the header stays put, only the list scrolls", () => {
  // Owner report 2026-09-27, from a real iPhone: scrolling the station's
  // place list dragged the station name, its line badges and the "18 places
  // · within 500 m" line off the top with it. Those are the frame; the rows
  // are the content. .subway-controller-scroll scrolls everything, so in
  // station-browse mode it must stop scrolling and hand that job to
  // .station-sheet-list alone.
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const browse = (sel: string) => `.subway-controller.station-browse ${sel}`;

  it("stops the outer scroller from scrolling in station-browse mode", () => {
    expect(css).toMatch(new RegExp(`${browse(".subway-controller-scroll").replace(/[.]/g, "\\.")} \\{[^}]*overflow: hidden`));
  });

  it("makes the list the one scroll container", () => {
    const rule = css.slice(css.indexOf(browse(".station-sheet-list")));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("overflow-y: auto");
    expect(body).toContain("min-height: 0");
    expect(body).toContain("flex: 1");
    // the last row must still clear the home indicator once the list scrolls
    expect(body).toContain("env(safe-area-inset-bottom)");
  });

  it("pins the grip, the title row and the count line", () => {
    for (const part of [".station-sheet-grip", ".station-sheet-head", ".station-sheet-sub"]) {
      expect(css, part).toMatch(new RegExp(`${browse(part).replace(/[.]/g, "\\.")}[^{]*\\{[^}]*flex: none`));
    }
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

  it("fits the dedicated search screen above the software keyboard", () => {
    expect(pickerCss).toContain("inset: 0 0 var(--kb, 0px)");
    expect(pickerCss).toContain("overscroll-behavior: contain");
  });

  it("does not put route editing inside the shop list", () => {
    // the only surviving mention is the comment recording why it left
    expect(controller).not.toContain("canAddActiveVia");
    expect(controller).not.toContain('className="subway-via-add inline"');
  });

  it("pluralises the place count", () => {
    expect(controller).toContain('rankedPlaces.length === 1 ? "{count} place" : "{count} places"');
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

  it("keeps the station stepper at the bottom of the panel without covering the list", () => {
    expect(controller).toContain('className="subway-station-focus pinned"');
    const rule = css.slice(css.indexOf(".subway-station-focus.pinned {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toBeTruthy();
    // It stays last in the panel's flex column instead of floating over the
    // scroller: `position: absolute` made the stepper hide the final ~80px of
    // the place list for good (WCAG 2.4.11 Focus Not Obscured).
    expect(body).not.toMatch(/position:\s*absolute/);
    expect(body).toMatch(/flex:\s*none/);
  });
});

describe("station search keeps the divider between its visible endpoints", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("does not remove the divider when search opens", () => {
    expect(css).not.toMatch(/\.subway-search-field-stack:has\(\.station-search-results\) \.station-combobox:has\(\.station-search-results\)\s*\{[^}]*border-top:\s*0;/);
    expect(css).toMatch(/\.station-combobox \+ \.station-combobox\s*\{[^}]*border-top:\s*1px solid var\(--border\)/);
  });
});
