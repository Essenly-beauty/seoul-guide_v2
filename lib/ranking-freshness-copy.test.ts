import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision, 2026-09-23: the product lists are refreshed manually every
// week or two, and again around a sale or a holiday. They are not a live feed,
// so the copy must not borrow a live feed's vocabulary — no "today's ranking",
// no "weekly ranking", nothing that dates a hand-made snapshot to the hour the
// visitor happens to read it.
//
// This mattered most on the place sheet, which cited an "Olive Young
// bestsellers — chain-wide chart" for a list of 14 hand-written samples. The
// 2026-09-23 verification found no such chart on Olive Young's site: the
// ranking screen has one tab, no review ranking, and the list's star ratings
// are an unfilled template repeated on every row.
const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// Claims of freshness, not denials of it. "In-store inventory is not live."
// is the copy we want to keep: it tells the visitor the opposite.
const LIVE_CLAIMS = [
  /\bToday'?s\b/i,
  /\bright now\b/i,
  /\bTrending now\b/i,
  /\breal[- ]?time\b/i,
  /\bthis week'?s\b/i,
  /\bweekly ranking\b/i,
  /\bdaily ranking\b/i,
  /\bhourly\b/i,
  /\bupdated (daily|hourly|every day)\b/i,
  /\bis live\b/i,
  /\blive (chart|ranking|feed|data)\b/i,
];
const DENIAL = /\bnot live\b|\bnot real[- ]?time\b|\bnot updated\b/i;

describe("ranking copy does not claim freshness the data cannot back", () => {
  const surfaces = [
    "components/ranking/ranking-page-client.tsx",
    "components/place/place-detail-body.tsx",
    "components/product/daiso-product-detail-body.tsx",
  ];

  it.each(surfaces)("uses no live-feed vocabulary in %s", (path) => {
    const source = read(path);
    // Only the strings a visitor reads, not identifiers or comments.
    const visible = [...source.matchAll(/"([^"\n]{4,})"|>([^<>{}\n]{4,})</g)]
      .map((m) => (m[1] ?? m[2]).trim())
      .filter((s) => /[a-z]/i.test(s) && !s.includes("/") && !/^[a-z-]+$/.test(s));
    const offenders = visible.filter(
      (text) => !DENIAL.test(text) && LIVE_CLAIMS.some((w) => w.test(text)),
    );
    expect(offenders, offenders.join(" | ")).toEqual([]);
  });

  it("does not cite an Olive Young chart that the retailer does not publish", () => {
    const sheet = read("components/place/place-detail-body.tsx");
    const oliveYoung = sheet.slice(sheet.indexOf("function OliveYoungPicks"));
    const upToNext = oliveYoung.slice(0, oliveYoung.indexOf("\nfunction "));
    expect(upToNext).not.toMatch(/chain-wide chart/);
    expect(upToNext).not.toMatch(/bestsellers/i);
  });

  it("still lets the Daiso sheet call its chart a chart, because there is one", () => {
    // daisomall.co.kr/ds/rank/C105 publishes 급상승/일간/주간 charts, verified
    // on 2026-09-23 with 50/50 agreement on the daily and weekly lists.
    const sheet = read("components/place/place-detail-body.tsx");
    expect(sheet).toMatch(/Daiso Mall ranking — chain-wide chart/);
  });
});
