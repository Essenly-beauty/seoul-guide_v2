import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Launch scope (2026-08-12 audit): the prototype booking flow — including
// its cancel-with-refund dialog — is out of the public surface until real
// bookings exist. The routes are closed at the config level (which, unlike
// page-level redirect(), doesn't throw NEXT_REDIRECT during client nav).
const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");

describe("launch scope: prototype routes stay closed", () => {
  it("redirects booking/trip/notification/review-form routes in next.config", () => {
    for (const source of ["/bookings", "/bookings/:id", "/trip", "/mypage/notifications", "/mypage/reviews/new"]) {
      expect(config).toContain(`source: "${source}"`);
    }
  });

  it("keeps the prototype page files deleted", () => {
    for (const gone of ["../app/bookings", "../app/trip", "../app/mypage/reviews/new", "../app/mypage/notifications"]) {
      expect(existsSync(new URL(gone, import.meta.url))).toBe(false);
    }
  });
});
