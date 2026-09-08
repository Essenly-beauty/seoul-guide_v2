import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const anchorSource = readFileSync(new URL("../components/ui/anchor-tabs.tsx", import.meta.url), "utf8");
const rankingSource = readFileSync(new URL("../components/ranking/ranking-page-client.tsx", import.meta.url), "utf8");
const rankingFooterUrl = new URL("../components/ranking/ranking-footer.tsx", import.meta.url);
const rankingFooterSource = existsSync(rankingFooterUrl) ? readFileSync(rankingFooterUrl, "utf8") : "";
const ratingSource = readFileSync(new URL("../components/ui/rating-bars.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../components/place/place-detail-body.tsx", import.meta.url), "utf8");

describe("navigation and compact control accessibility", () => {
  it("describes in-page anchors as navigation instead of tabs", () => {
    expect(anchorSource).toContain('<nav className="anchortabs"');
    expect(anchorSource).toContain('aria-current={active === s.id ? "location" : undefined}');
    expect(anchorSource).not.toContain('role="tablist"');
    expect(anchorSource).not.toContain('role="tab"');
  });

  it("implements the complete keyboard contract for ranking tabs", () => {
    expect(rankingSource).toContain('aria-controls={`ranking-panel-${tabKey}`}');
    expect(rankingSource).toContain("tabIndex={tab === tabKey ? 0 : -1}");
    expect(rankingSource).toContain("tabIndex={daisoTab === tabKey ? 0 : -1}");
    expect(rankingSource).toContain('event.key === "ArrowRight"');
    expect(rankingSource).toContain('role="tabpanel"');
    expect(rankingSource).toContain('aria-labelledby={`ranking-tab-${tab}`}');
    expect(rankingSource).toContain('aria-labelledby={`ranking-tab-${daisoTab}`}');
  });

  it("exposes retailer selection without relying on color or polluting accessible names", () => {
    expect(rankingFooterSource).toContain('aria-pressed={retailer === "olive_young"}');
    expect(rankingFooterSource).toContain('aria-pressed={retailer === "daiso"}');
    expect(rankingFooterSource).toContain('aria-label="Olive Young"');
    expect(rankingFooterSource).toContain('aria-label="Daiso"');
    expect(rankingFooterSource).toContain('src="/brands/olive-young-mark.svg"');
    expect(rankingFooterSource).toContain('src="/brands/daiso-mark.svg"');
    expect(rankingFooterSource.match(/alt=""/g)).toHaveLength(2);
    expect(rankingFooterSource.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(rankingFooterSource).not.toContain("Selected");
    expect(rankingFooterSource).not.toContain("✓");
    expect(rankingFooterSource).not.toContain("ranking-footer-selection");
  });

  it("announces the percentage represented by every rating bar", () => {
    expect(ratingSource).toContain('role="img"');
    expect(ratingSource).toContain("stars: ${percent}%");
  });

  it("moves focus into the detail menu and supports arrow keys", () => {
    expect(detailSource).toContain("menuItemRefs");
    expect(detailSource).toContain('event.key === "ArrowDown"');
    expect(detailSource).toContain("triggerRef.current?.focus()");
  });
});
