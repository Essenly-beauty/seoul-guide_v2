import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const layoutSource = source("../app/layout.tsx");
const cssSource = source("../app/globals.css");
const searchSource = source("../app/search/page.tsx");
const rankingSource = source("../app/ranking/page.tsx");
const searchFieldSource = source("../components/ui/search-field.tsx");
const subwaySource = source("../components/subway/subway-route-controller.tsx");
const dialogHookSource = source("../components/ui/use-dialog-focus.ts");
const bottomSheetSource = source("../components/ui/bottom-sheet.tsx");
const bookingSource = source("../components/booking/booking-sheet.tsx");
const signoutSource = source("../components/ui/signout-modal.tsx");
const filterSource = source("../components/map/filter-sheet.tsx");
const profileSource = source("../app/onboarding/beauty-profile/page.tsx");
const settingsSource = source("../app/settings/page.tsx");
const reviewSource = source("../app/mypage/reviews/new/page.tsx");

describe("mobile interaction contracts", () => {
  it("allows user zoom and resizes the viewport for the software keyboard", () => {
    expect(layoutSource).not.toMatch(/maximumScale\s*:\s*1/);
    expect(layoutSource).toContain('interactiveWidget: "resizes-content"');
  });

  it("keeps shared touch targets large enough to use reliably", () => {
    expect(cssSource).toMatch(/\.iconbtn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/);
    expect(cssSource).toMatch(/\.chip\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(cssSource).toMatch(/\.input\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?font-size:\s*16px;/);
    expect(cssSource).toMatch(/\.bottomnav\s+\.nav\s*\{[\s\S]*?min-height:\s*48px;/);
    expect(cssSource).toMatch(/button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
    expect(cssSource).toMatch(/\.subway-live-pill\s*\{[^}]*min-height:\s*44px;/);
  });

  it("does not communicate the current bottom-navigation item by color alone", () => {
    expect(cssSource).toContain('.bottomnav .nav[aria-current="page"]::before');
  });

  it("uses mobile search keyboards and restores focus after clearing", () => {
    expect(searchFieldSource).toContain('type="search"');
    expect(searchFieldSource).toContain('inputMode="search"');
    expect(searchFieldSource).toContain('enterKeyHint="search"');
    expect(searchFieldSource).toContain('autoComplete="off"');
    for (const pageSource of [searchSource, rankingSource]) {
      expect(pageSource).toContain("<SearchField");
      expect(pageSource).toContain("onClear={clearSearch}");
      expect(pageSource).toContain("requestAnimationFrame");
      expect(pageSource).not.toMatch(/style=\{\{\s*width:\s*(28|32),\s*height:\s*(28|32)/);
    }
  });

  it("keeps subway endpoint search continuous and explains disabled routing", () => {
    expect(subwaySource).toContain('type="search"');
    expect(subwaySource).toContain('inputMode="search"');
    expect(subwaySource).toContain('enterKeyHint="search"');
    expect(subwaySource).toContain("arrivalInputRef.current?.focus()");
    expect(subwaySource).toContain('id="subway-route-help"');
    expect(subwaySource).toContain('aria-describedby={!canApplyRoute ? "subway-route-help" : undefined}');
  });
});

describe("dialog and form accessibility contracts", () => {
  it("provides one reusable focus trap with Escape and focus restoration", () => {
    expect(dialogHookSource).toContain('event.key === "Escape"');
    expect(dialogHookSource).toContain('event.key !== "Tab"');
    expect(dialogHookSource).toContain("previouslyFocused");
    expect(dialogHookSource).toContain(".focus()");
  });

  it("applies dialog semantics and focus management to sheets and confirmation dialogs", () => {
    for (const dialogSource of [bookingSource, signoutSource]) {
      expect(dialogSource).toContain("useDialogFocus");
      expect(dialogSource).toContain('role="dialog"');
      expect(dialogSource).toContain('aria-modal="true"');
      expect(dialogSource).toContain("tabIndex={-1}");
    }
    expect(filterSource).toContain("<BottomSheet");
    expect(bottomSheetSource).toContain("useDialogFocus");
    expect(bottomSheetSource).toContain('role="dialog"');
    expect(bottomSheetSource).toContain('aria-modal="true"');
    expect(bottomSheetSource).toContain("tabIndex={-1}");
  });

  it("links profile labels and review validation help to their controls", () => {
    expect(profileSource).toContain('htmlFor="current-hair-brand"');
    expect(settingsSource).toContain('htmlFor="settings-hair-brand"');
    expect(settingsSource).toContain('htmlFor="settings-country"');
    // launch scope: the mock write-review form is a redirect now — the real
    // composer (with its own a11y contract) lives in place-detail-body
    expect(reviewSource).toContain("redirect(");
  });
});
