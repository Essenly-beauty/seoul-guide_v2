import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentUrl = new URL("../components/booking/cancel-booking-button.tsx", import.meta.url);
const cancelSource = existsSync(componentUrl) ? readFileSync(componentUrl, "utf8") : "";
const bookingSource = readFileSync(new URL("../app/bookings/[id]/page.tsx", import.meta.url), "utf8");

describe("destructive booking actions", () => {
  it("requires an accessible confirmation before cancelling", () => {
    expect(cancelSource).toContain("useDialogFocus");
    expect(cancelSource).toContain('role="dialog"');
    expect(cancelSource).toContain('aria-modal="true"');
    expect(cancelSource).toContain("Full refund");
    expect(cancelSource).toContain("₩45,000");
  });

  it("uses the confirmation control on the booking detail page", () => {
    expect(bookingSource).toContain("<CancelBookingButton");
    expect(bookingSource).not.toContain('toast="Cancel — full refund (stub)"');
  });
});
