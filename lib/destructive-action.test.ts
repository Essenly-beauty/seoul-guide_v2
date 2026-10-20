import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Prototype features remain closed; persistent bookings now have live routes.
const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");

describe("launch scope: prototype routes stay closed", () => {
  it("opens booking routes only for the persistent booking screens", () => {
    expect(config).not.toContain('source: "/bookings"');
    expect(config).not.toContain('source: "/bookings/:id"');
    expect(existsSync(new URL('../app/bookings/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/bookings/[id]/page.tsx', import.meta.url))).toBe(true);
  });
  it("redirects trip/notification/review-form routes in next.config", () => {
    for (const source of ["/trip", "/mypage/notifications", "/mypage/reviews/new"]) {
      expect(config).toContain(`source: "${source}"`);
    }
  });

  it("keeps the prototype page files deleted", () => {
    for (const gone of ["../app/trip", "../app/mypage/reviews/new", "../app/mypage/notifications"]) {
      expect(existsSync(new URL(gone, import.meta.url))).toBe(false);
    }
  });
});
