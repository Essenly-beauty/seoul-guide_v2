import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Launch scope (2026-08-12 audit): the prototype booking flow — including
// its cancel-with-refund dialog — is out of the public surface until real
// bookings exist. These routes must stay redirects, not demo pages.
const bookingsList = readFileSync(new URL("../app/bookings/page.tsx", import.meta.url), "utf8");
const bookingDetail = readFileSync(new URL("../app/bookings/[id]/page.tsx", import.meta.url), "utf8");

describe("launch scope: prototype booking routes stay closed", () => {
  it("bookings list redirects instead of rendering demo confirmations", () => {
    expect(bookingsList).toContain("redirect(");
    expect(bookingsList).not.toContain("listrow");
  });

  it("booking detail redirects instead of claiming deposits/refunds", () => {
    expect(bookingDetail).toContain("redirect(");
    expect(bookingDetail).not.toContain("CancelBookingButton");
    expect(bookingDetail).not.toContain("₩45,000");
  });
});
