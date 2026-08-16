import { describe, expect, it } from "vitest";
import { formatPhone, toE164 } from "./phone";

describe("toE164", () => {
  it("composes Korean mobile numbers (leading 0 dropped)", () => {
    expect(toE164("+82", "010-1234-5678")).toBe("+821012345678");
    expect(toE164("+82", "01012345678")).toBe("+821012345678");
  });
  it("keeps other countries' digits as-is", () => {
    expect(toE164("+1", "415 555 0134")).toBe("+14155550134");
    expect(toE164("+81", "090-1234-5678")).toBe("+819012345678");
  });
  it("rejects too-short and too-long input", () => {
    expect(toE164("+82", "1234")).toBeNull();
    expect(toE164("+82", "1234567890123456")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups for display", () => {
    expect(formatPhone("+821012345678")).toBe("+82 10-1234-5678");
  });
});
