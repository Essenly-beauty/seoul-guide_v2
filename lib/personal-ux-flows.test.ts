import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const profilePage = source("app/onboarding/beauty-profile/page.tsx");
const profileEditor = source("components/mypage/beauty-profile-editor.tsx");
const reviewsPage = source("app/mypage/reviews/page.tsx");
const reviewDetail = source("app/mypage/reviews/[id]/page.tsx");
const reviewEditor = source("app/mypage/reviews/[id]/edit/page.tsx");
const ratings = source("lib/ratings.ts");
const routes = source("lib/routes.ts");
const favorites = source("app/favorites/page.tsx");
const mapScreen = source("components/map/map-screen.tsx");
const mapSheet = source("components/map/map-sheet.tsx");
const menu = source("app/menu/page.tsx");
const blog = source("app/blog/page.tsx");
const saved = source("app/favorites/page.tsx");
const ranking = source("components/ranking/ranking-page-client.tsx");
const topBar = source("components/ui/top-bar.tsx");
const css = source("app/globals.css") + source("app/customer-theme.css");

describe("editable beauty profile", () => {
  it("shows the complete question set and saves revised selections", () => {
    expect(profilePage).toContain("<BeautyProfileEditor />");
    expect(profileEditor).toContain("QUESTIONS.map");
    expect(profileEditor).toContain("answerQuestion");
    expect(profileEditor).toContain("selected={selected}");
    expect(profileEditor).toContain('aria-label={t("Beauty profile answers")}');
  });
});

describe("my review inspection", () => {
  it("uses a dedicated review detail route and a quieter metadata row", () => {
    expect(routes).toContain("review: (id: string)");
    expect(reviewsPage).toContain("routes.review(place!.id)");
    expect(reviewsPage).toContain("review-list-meta");
    expect(reviewsPage).not.toContain("<RatingLine rating={rating} plain />");
  });

  it("shows the full owned review and centralizes edit eligibility", () => {
    expect(ratings).toContain("export function canEditMyReview");
    expect(reviewDetail).toContain("useMyRatings");
    expect(reviewDetail).toContain("canEditMyReview");
    expect(reviewDetail).toContain("routes.place(id)");
    expect(reviewDetail).toContain("Your review");
    expect(reviewDetail).toContain("review-detail-empty");
    expect(reviewDetail).toContain("routes.reviewEdit(id)");
    expect(reviewDetail).not.toContain('`${routes.place(id)}#d-reviews`');
    expect(css).toMatch(
      /\.review-detail-place h1\s*\{[^}]*font-family:\s*var\(--sans\)[^}]*font-size:\s*20px/,
    );
  });

  it("opens a dedicated, real review composer and returns to the review after saving", () => {
    expect(routes).toContain("reviewEdit: (id: string)");
    expect(reviewEditor).toContain("await setReview(id, rating, draft, postPublic)");
    expect(reviewEditor).toContain("if (!saved)");
    expect(reviewEditor).toContain('role="alert"');
    expect(reviewEditor).toContain("REVIEW_MAX_LEN");
    expect(reviewEditor).toContain('aria-label="Your rating"');
    expect(reviewEditor).toContain('aria-label="Your review"');
    expect(reviewEditor).toContain("Post publicly");
    expect(reviewEditor).toContain("router.replace(routes.review(id))");
  });

  it("initializes the review form once so a failed optimistic save cannot erase the draft", () => {
    expect(reviewEditor).toContain("initializedReviewId");
    expect(reviewEditor).toContain("if (!ready || !review || initializedReviewId.current === id) return");
    expect(reviewEditor).toContain("initializedReviewId.current = id");
    expect(reviewEditor).toMatch(/useEffect\(\(\) => \{[\s\S]*?initializedReviewId\.current = id[\s\S]*?\}, \[id, ready, review\]\)/);
  });
});

describe("shared page header rhythm", () => {
  it("keeps the remaining navigation bars compact and aligned", () => {
    expect(topBar).toContain('className="topbar-slot left"');
    expect(topBar).toContain('className="topbar-slot right"');
    expect(css).toMatch(/\.topbar\s*\{[^}]*min-height:\s*calc\(52px \+ env\(safe-area-inset-top\)\)/);
  });

  it("does not repeat the main tab labels in a separate sticky header", () => {
    for (const page of [blog, saved, ranking, menu]) {
      expect(page).not.toContain("<TopBar");
      expect(page).toContain("<h1");
    }
    for (const page of [blog, saved, menu]) expect(page).toContain("app-tab-content");
    // Ranking keeps retailer context and controls fixed while its results scroll.
    expect(ranking).toContain('data-testid="ranking-screen"');
    expect(ranking).toContain('className="ranking-retailer-heading"');
    expect(ranking).toContain('<h1 aria-label={t(rankingTitle)}>');
    expect(ranking).not.toContain("<BrandMark");
  });
});

describe("saved and shared place journeys", () => {
  it("opens See all as a saved-only map mode", () => {
    expect(routes).toContain('savedPlacesMap: "/map?saved=1"');
    expect(favorites).toContain("href={routes.savedPlacesMap}");
    expect(mapScreen).toContain('const savedParam = searchParams.get("saved")');
    expect(mapScreen).toContain('savedParam === "1"');
    expect(mapScreen).toContain("Your saved places");
  });

  it("explains that shared lists open on the web and remain savable", () => {
    expect(favorites).toContain("No app install needed");
    expect(mapScreen).toContain("<SharedListReadyBanner");
    expect(mapScreen).toContain("onSaveAll={saveAllShared}");
    expect(mapScreen).toContain('nudge("favorite")');
  });

  it("limits map-list scrolling to the visible rows instead of a padded blank tail", () => {
    expect(css).not.toContain("34.5vh");
    expect(css).not.toContain("max-height: calc(48vh - 128px");
    expect(css).toMatch(
      /\.mapsheet\s*\{[^}]*--sheet-half-offset:\s*42%/,
    );
    expect(css).toMatch(
      /\.mapsheet:not\(\.has-selection\) \.mapsheet-body\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0[^}]*padding-bottom:\s*12px/,
    );
    expect(css).toMatch(
      /\.mapsheet\.half:not\(\.has-selection\)::after\s*\{[^}]*flex:\s*0 0 var\(--sheet-half-offset\)/,
    );
  });

  it("keeps long bilingual map rows inside the sheet width", () => {
    expect(mapSheet).toContain('className="maprow-copy"');
    expect(css).toMatch(
      /\.maprow-copy\s*\{[^}]*flex:\s*1[^}]*min-width:\s*0[^}]*text-align:\s*left/,
    );
  });

  it("never exposes horizontal scrolling in the map list viewport", () => {
    expect(css).toMatch(/\.mapsheet-body\s*\{[^}]*overflow-y:\s*auto[^}]*overflow-x:\s*hidden/);
  });
});

describe("My page footer", () => {
  it("ends after support instead of repeating the brand lockup", () => {
    expect(menu).not.toContain("BrandMark");
    expect(menu).not.toContain("BrandWordmark");
    expect(menu).not.toContain("Seoul beauty, mapped.");
  });
});
