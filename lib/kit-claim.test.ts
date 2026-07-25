import { describe, expect, it } from "vitest";
import { validateKitClaim } from "./kit-claim";

describe("hair-kit claim validation", () => {
  it("accepts a valid cafe pickup request without an accommodation address", () => {
    expect(validateKitClaim({
      email: "traveler@example.com",
      via: "cafe",
      address: "",
    })).toEqual({});
  });

  it("rejects an invalid contact email", () => {
    expect(validateKitClaim({
      email: "traveler.example.com",
      via: "cafe",
      address: "",
    })).toEqual({ email: "Enter a valid email address." });
  });

  it("requires an accommodation address for hotel delivery", () => {
    expect(validateKitClaim({
      email: "traveler@example.com",
      via: "hotel",
      address: " ",
    })).toEqual({ address: "Enter your Seoul accommodation name and address." });
  });
});
