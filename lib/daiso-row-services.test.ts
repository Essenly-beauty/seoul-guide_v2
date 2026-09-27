import { describe, expect, it } from "vitest";
import { daisoRowServices } from "./daiso-row-services";

describe("daisoRowServices", () => {
  it("shows only confirmed Daiso services in a stable order", () => {
    expect(daisoRowServices({ type: "daiso", serviceTags: ["sim-card", "tax-refund"] })).toEqual(["Tax refund", "SIM card"]);
    expect(daisoRowServices({ type: "daiso", serviceTags: ["sim-card"] })).toEqual(["SIM card"]);
    expect(daisoRowServices({ type: "daiso" })).toEqual([]);
    expect(daisoRowServices({ type: "olive_young", serviceTags: ["tax-refund"] })).toEqual([]);
  });
});
