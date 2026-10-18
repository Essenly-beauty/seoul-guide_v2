import { describe, expect, it } from "vitest";
import { googleDirectionsUrl } from "./geo";
import { googleStationDirectionsUrl } from "./subway-directions";

const departure = { name: "Gangnam", lat: 37.4979, lng: 127.0276 };
const arrival = { name: "Hongik Univ.", lat: 37.5572, lng: 126.9254 };

function parameters(from = departure, to = arrival, via?: { lat: number; lng: number }[]) {
  return new URL(googleStationDirectionsUrl(from, to, via)).searchParams;
}

describe("Google station-to-station directions", () => {
  it("preserves both named endpoints and their Seoul station context", () => {
    const params = parameters();
    expect(params.get("origin")).toBe("Gangnam Station, Seoul, South Korea");
    expect(params.get("destination")).toBe("Hongik Univ. Station, Seoul, South Korea");
    expect(params.get("travelmode")).toBe("transit");
    expect(params.get("api")).toBe("1");
  });

  it("encodes spaces, punctuation and ampersands without creating extra parameters", () => {
    const params = parameters(
      { ...departure, name: "Seoul Station" },
      { ...arrival, name: "City Hall (Arts & Culture)" },
    );
    expect(params.get("origin")).toBe("Seoul Station, Seoul, South Korea");
    expect(params.get("destination")).toBe("City Hall (Arts & Culture) Station, Seoul, South Korea");
    expect([...params.keys()].sort()).toEqual(["api", "destination", "origin", "travelmode"]);
  });

  it("carries via coordinates in the selected order", () => {
    const params = parameters(departure, arrival, [
      { lat: 37.4765, lng: 126.9816 },
      { lat: 37.5609, lng: 126.9863 },
    ]);
    expect(params.get("waypoints")).toBe("37.4765,126.9816|37.5609,126.9863");
    expect(parameters(departure, arrival, []).has("waypoints")).toBe(false);
    expect(parameters().has("waypoints")).toBe(false);
  });

  it("leaves the generic named-place handoff using the device location", () => {
    const params = new URL(googleDirectionsUrl(
      { ...arrival, name: "Olive Young", address: "Seoul 1층" },
      departure,
    )).searchParams;
    expect(params.has("origin")).toBe(false);
    expect(params.get("destination")).toBe("Olive Young, Seoul");
  });
});
