import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const anchorSource = readFileSync(new URL("../components/ui/anchor-tabs.tsx", import.meta.url), "utf8");
const rankingSource = readFileSync(new URL("../app/ranking/page.tsx", import.meta.url), "utf8");
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
    expect(rankingSource).toContain('aria-controls={`ranking-panel-${t.key}`}');
    expect(rankingSource).toContain("tabIndex={tab === t.key ? 0 : -1}");
    expect(rankingSource).toContain('event.key === "ArrowRight"');
    expect(rankingSource).toContain('role="tabpanel"');
    expect(rankingSource).toContain('aria-labelledby={`ranking-tab-${tab}`}');
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
