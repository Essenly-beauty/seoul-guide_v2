import { describe, expect, it } from "vitest";
import {
  getDaisoProduct,
  parseDaisoProductRouteId,
} from "@/lib/daiso-product-detail";

describe("Daiso product detail lookup", () => {
  it("accepts only the namespaced numeric route id", () => {
    expect(parseDaisoProductRouteId("daiso:1018161")).toBe("1018161");
    // What app/shop/[id]/page.tsx actually receives for /shop/daiso%3A1018161.
    expect(parseDaisoProductRouteId("daiso%3A1018161")).toBe("1018161");
    expect(parseDaisoProductRouteId("daiso%253A1018161")).toBeNull();
    expect(parseDaisoProductRouteId("daiso%E0%A4%A")).toBeNull();
    expect(parseDaisoProductRouteId("daiso:0")).toBeNull();
    expect(parseDaisoProductRouteId("daiso:not-a-number")).toBeNull();
    expect(parseDaisoProductRouteId("1018161")).toBeNull();
    expect(parseDaisoProductRouteId("daiso:1018161/extra")).toBeNull();
  });

  it("returns only records in the approved generated dataset", () => {
    expect(getDaisoProduct("1018161")?.productNo).toBe("1018161");
    expect(getDaisoProduct("999999999999")).toBeNull();
    expect(getDaisoProduct("not-a-number")).toBeNull();
  });
});
