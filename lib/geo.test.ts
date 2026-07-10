import { describe, it, expect } from "vitest";
import { haversineKm, formatDistance, walkMinutes, kakaoMapUrl, naverMapUrl, googleMapsUrl, MYEONGDONG, GANGNAM_STATION } from "./geo";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(MYEONGDONG, MYEONGDONG)).toBe(0);
  });
  it("measures Myeongdong→Gangnam stn ≈ 8.3km (±0.1)", () => {
    expect(haversineKm(MYEONGDONG, GANGNAM_STATION)).toBeGreaterThan(8.2);
    expect(haversineKm(MYEONGDONG, GANGNAM_STATION)).toBeLessThan(8.4);
  });
});

describe("formatDistance", () => {
  it("uses meters under 1km, rounded to 10m", () => {
    expect(formatDistance(0.847)).toBe("850 m");
  });
  it("uses km with one decimal at 1km+", () => {
    expect(formatDistance(1.23)).toBe("1.2 km");
  });
  it("rounds meters up into km at the 1000m boundary", () => {
    expect(formatDistance(0.996)).toBe("1.0 km");
  });
});

describe("walkMinutes", () => {
  it("approximates 67m/min, minimum 1", () => {
    expect(walkMinutes(1)).toBe(15); // 1000/67 ≈ 14.9 → round 15
    expect(walkMinutes(0.01)).toBe(1);
  });
});

describe("map URLs (no API keys)", () => {
  it("kakao web link embeds name and coords", () => {
    expect(kakaoMapUrl("HOSU DOSAN", 37.524, 127.038)).toBe(
      "https://map.kakao.com/link/map/HOSU%20DOSAN,37.524,127.038",
    );
  });
  it("naver search link uses Korean name", () => {
    expect(naverMapUrl("호수 도산점")).toBe(
      `https://map.naver.com/p/search/${encodeURIComponent("호수 도산점")}`,
    );
  });
  it("google universal link uses coords", () => {
    expect(googleMapsUrl(37.524, 127.038)).toBe(
      "https://www.google.com/maps/search/?api=1&query=37.524%2C127.038",
    );
  });
});

describe("GANGNAM_STATION", () => {
  it("is at Gangnam Station (Seoul bounding box, Gangnam-gu)", () => {
    expect(GANGNAM_STATION.lat).toBeCloseTo(37.4979, 3);
    expect(GANGNAM_STATION.lng).toBeCloseTo(127.0276, 3);
  });
});
