import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { SubwayRouteController } from "@/components/subway/subway-route-controller";
import { findRoute, findRouteVia } from "./subway";

const noop = () => {};
const defaults: ComponentProps<typeof SubwayRouteController> = {
  departureId: "gangnam", arrivalId: "hongik_univ", viaIds: [],
  route: findRoute("gangnam", "hongik_univ"), activeStationId: "gangnam",
  nearbyStationId: null, radiusKm: 0.5, category: "all", places: [], selectedPlaceId: null,
  onDeparture: noop, onArrival: noop, onVias: noop, onStation: noop, onRadius: noop,
  onCategory: noop, onPlace: noop, onClearRoute: noop, onEditingChange: noop,
  onSnapChange: noop, locationStatus: "idle", onRetryLocation: noop, onClose: noop,
};

function render(overrides: Partial<typeof defaults> = {}) {
  return load(renderToStaticMarkup(<SubwayRouteController {...defaults} {...overrides} />));
}

describe("subway route controller", () => {
  it("hands Google the selected named departure as well as the arrival", () => {
    const $ = render();
    const params = new URL($("a.subway-route-open").attr("href")!).searchParams;
    expect(params.get("origin")).toBe("Gangnam Station, Seoul, South Korea");
    expect(params.get("destination")).toBe("Hongik Univ. Station, Seoul, South Korea");
  });

  it("renders a preview label and hands current timings and transfers to Google", () => {
    const $ = render();
    expect($(".subway-route-summary").text()).toContain("Route preview");
    expect($(".subway-route-summary").text()).toContain("Check Google Maps for current timings and transfers.");
    expect($(".subway-route-summary").text()).not.toMatch(/\d+\s*min\b/);
    expect($("button[aria-label='Show nearby places']").length).toBe(1);
  });

  it("retains the selected order of via stations in the rendered handoff", () => {
    const $ = render({ viaIds: ["sadang", "myeongdong"], route: findRouteVia("gangnam", ["sadang", "myeongdong"], "hongik_univ") });
    const params = new URL($("a.subway-route-open").attr("href")!).searchParams;
    expect(params.get("waypoints")?.split("|")).toHaveLength(2);
    expect(params.get("origin")).toContain("Gangnam Station");
  });

  it("renders both labelled endpoint fields and the swap action", () => {
    const $ = render({ route: null, activeStationId: null });
    expect($(".station-combobox label").map((_, label) => $(label).text()).get()).toEqual(["Departure", "Arrival"]);
    expect($("input[role='combobox']").map((_, input) => $(input).attr("value")).get()).toEqual(["Gangnam", "Hongik Univ."]);
    expect($("button[aria-label='Swap departure and arrival']").attr("disabled")).toBeUndefined();
  });

  it("still rejects identical endpoints before applying a route", () => {
    const $ = render({ route: null, activeStationId: null, arrivalId: "gangnam" });
    expect($("[role='alert']").text()).toContain("Departure and arrival must be different stations.");
    expect($(".subway-search-footer button").attr("disabled")).toBe("disabled");
  });
});
