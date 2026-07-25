import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Design-system usage contract (docs/design-system.md §5):
// new code must use <Button>/<IconButton>/<Chip> — raw `btn`/`iconbtn`/`chip`
// class strings are frozen to the audited allowlist below (each entry is a
// documented exception: ref-bearing dialog controls, radio-semantics chips,
// ActionButton/launcher className passthrough, non-interactive status spans).
// Removing a file from this list is always fine; adding one needs a review.

const ALLOWLIST = new Set([
  // system pieces themselves
  "components/ui/button.tsx",
  "components/ui/chip.tsx",
  "components/ui/icon-button.tsx",
  "components/ui/back-button.tsx",
  "components/ui/hamburger-menu.tsx",
  // ActionButton/launcher className passthrough + ref-bearing dialog controls
  "app/blog/[slug]/page.tsx",
  "app/blog/page.tsx",
  "app/bookings/[id]/page.tsx",
  "app/bookings/page.tsx",
  "app/menu/page.tsx",
  "app/mypage/reviews/new/page.tsx",
  "app/not-found.tsx",
  "app/ranking/page.tsx",
  "app/settings/page.tsx",
  "app/shop/[id]/page.tsx",
  "app/support/page.tsx",
  "components/booking/booking-sheet.tsx",
  "components/booking/cancel-booking-button.tsx",
  "components/booking/channel-sheet.tsx",
  "components/kit/kit-survey.tsx",
  "components/map/filter-sheet.tsx",
  "components/map/map-screen.tsx",
  "components/place/place-detail-body.tsx",
  "components/product/product-cta-bar.tsx",
  "components/product/product-detail-body.tsx",
  "components/shop/routine-content.tsx",
  "components/subway/subway-route-controller.tsx",
  "components/ui/feedback-sheet.tsx",
  "components/ui/signout-modal.tsx",
]);

const RAW_CONTROL = /className=\{?"[^"]*\b(btn|iconbtn|chip)\b/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

describe("design-system usage contract", () => {
  it("no new files introduce raw btn/iconbtn/chip class strings", () => {
    const offenders = [...tsxFiles("app"), ...tsxFiles("components")]
      .filter((path) => RAW_CONTROL.test(readFileSync(path, "utf8")))
      .filter((path) => !ALLOWLIST.has(path));
    expect(offenders).toEqual([]);
  });

  it("deprecated ghost/outline button classes do not come back", () => {
    const offenders = [...tsxFiles("app"), ...tsxFiles("components")]
      .filter((path) => /"btn (sm )?(ghost|outline)/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
