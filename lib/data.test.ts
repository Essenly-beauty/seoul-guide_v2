import { describe, it, expect } from "vitest";
import { PLACES } from "./data";

describe("PLACES coordinates", () => {
  it("every place has coords inside the Seoul bounding box", () => {
    for (const p of PLACES) {
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(37.4);
      expect(p.lat, `${p.id} lat`).toBeLessThan(37.7);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(126.8);
      expect(p.lng, `${p.id} lng`).toBeLessThan(127.2);
    }
  });
});
