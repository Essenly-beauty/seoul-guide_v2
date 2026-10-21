import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dateLabel, dayLabel } from "./dashboard";

// 2026-10-21 화면 문장·레이아웃 점검(docs/designs/partner-admin-redesign-20261019/qa/impl-layout-audit.cjs)
// 에서 브라우저로 잰 결함을 다시 만들지 않게 CSS 규칙을 고정한다. 실제 화면 확인은 그 스크립트로 한다.
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const dashboard = read("components/partner/dashboard.css");
const partnerCss = ["components/partner/dashboard.css", "components/partner/partner.module.css", "components/partner/partner-editors.module.css", "components/partner/partner-media-manager.module.css"].map(read).join("\n");
const rule = (selector: string) => {
  const at = dashboard.lastIndexOf(`${selector} {`);
  return at < 0 ? "" : dashboard.slice(at, dashboard.indexOf("}", at));
};

describe("partner layout contracts", () => {
  it("breaks Korean only between words, and only splits a word that is wider than its box", () => {
    expect(rule("[data-partner-shell]")).toMatch(/word-break:keep-all/);
    expect(rule("[data-partner-shell]")).toMatch(/overflow-wrap:break-word/);
  });

  it("does not let the customer app's sticky .topbar pin the partner header over the sticky booking detail", () => {
    expect(rule("[data-partner-shell] .topbar")).toMatch(/position:static/);
  });

  it("keeps toolbar controls and tabs at their natural width instead of squeezing their labels", () => {
    expect(rule("[data-partner-shell] .toolbar")).toMatch(/flex-wrap:wrap/);
    expect(dashboard).toMatch(/\[data-partner-shell\] \.toolbar>\.seg \{flex:none;/);
    // 휴대폰에서는 다섯 버튼이 줄 폭을 나눠 쓴다(줄어들지는 않음)
    expect(dashboard).toMatch(/@media\(max-width:900px\)\{\[data-partner-shell\] \.toolbar>\.seg \{display:flex;width:100%;\}\[data-partner-shell\] \.toolbar>\.seg button \{flex:1 0 auto;/);
    expect(dashboard).toMatch(/\[data-partner-shell\] \.seg button,\[data-partner-shell\] \.tabs button \{flex-shrink:0;\}/);
    expect(rule("[data-partner-shell] .live-range summary")).toMatch(/white-space:nowrap/);
    expect(dashboard).toMatch(/:is\(\.pagehead,\.card-head,\.side-top\) \.btn \{white-space:nowrap;flex-shrink:0;\}/);
  });

  it("switches to the one-column phone layout below 900px so 820–834px tablets are not squeezed beside the sidebar", () => {
    expect(partnerCss).not.toMatch(/max-width: ?800px/);
    expect(partnerCss).toMatch(/max-width: ?900px/);
  });

  it("places every settlement cell on its own grid row on phones so the amount never covers the customer link", () => {
    const phone = dashboard.slice(dashboard.lastIndexOf("@media(max-width:900px){[data-partner-shell] .settle-table td:nth-child(1)"));
    for (let n = 1; n <= 5; n++) expect(phone).toMatch(new RegExp(`\\.settle-table td:nth-child\\(${n}\\) \\{grid-column:[^;]+;grid-row:\\d`));
  });

  it("keeps calendar event lines at full height and hides lower-priority lines in short blocks", () => {
    expect(rule("[data-partner-shell] .live-calendar-event")).toMatch(/container-type:size/);
    expect(dashboard).toMatch(/\.live-calendar-event>:not\(\.live-cleanup\) \{flex-shrink:0;\}/);
  });

  it("keeps keyboard focus rings inside segments and tabs that can scroll sideways", () => {
    expect(dashboard).toMatch(/:is\(\.seg,\.tabs\) button:focus-visible \{outline-offset:-3px;\}/);
  });

  it("lets cells that hold long names, notes or contacts shrink and wrap inside a word", () => {
    expect(dashboard).toMatch(/:is\([^)]*\.side dd[^)]*\.activity li>\*[^)]*\) \{min-width:0;overflow-wrap:anywhere;\}/);
  });

  it("keeps the disclosure marker on the booking-history summary while giving it a 44px touch target", () => {
    expect(dashboard).toMatch(/\.side details>summary \{min-height:44px;display:list-item;/);
  });

  it("labels week columns with the day only; the full date stays for assistive text", () => {
    expect(dayLabel("2026-10-19")).toBe("19일 (월)");
    expect(dateLabel("2026-10-19")).toBe("10월 19일 (월)");
  });
});
