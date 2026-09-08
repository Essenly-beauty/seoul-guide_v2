import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import humanVerdicts from "../data/place-audit-verdicts.json";
import { CATALOGUE_PLACES } from "../lib/data";
import {
  buildAuditEntries,
  renderAuditMarkdown,
  summarizePlaceAudit,
  type KakaoHoursEvidence,
} from "../lib/place-audit";
import { parseHumanPlaceVerdictFile } from "../lib/place-audit-batch";
import hoursOverrides from "./lib/hours-overrides.json";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = join(ROOT, "reports", "place-audit.json");
const MARKDOWN_PATH = join(ROOT, "reports", "place-audit.md");
const check = process.argv.includes("--check");

const kakaoHours = Object.fromEntries(
  Object.entries(hoursOverrides).map(([id, value]) => [id, {
    kakaoPlaceId: value.kakaoPlaceId,
    kakaoName: value.kakaoName,
    openDays: value.openDays,
  }]),
) as Record<string, KakaoHoursEvidence>;

const entries = buildAuditEntries(
  CATALOGUE_PLACES,
  parseHumanPlaceVerdictFile(humanVerdicts),
  kakaoHours,
);
const summary = summarizePlaceAudit(entries);
const json = `${JSON.stringify({ schemaVersion: 1, summary, places: entries }, null, 2)}\n`;
const markdown = renderAuditMarkdown(entries, summary);

if (check) {
  const currentJson = readFileSync(JSON_PATH, "utf8");
  const currentMarkdown = readFileSync(MARKDOWN_PATH, "utf8");
  if (currentJson !== json || currentMarkdown !== markdown) {
    console.error("place audit reports are stale; run npm run audit:data");
    process.exitCode = 1;
  } else {
    console.log("place audit reports are current");
  }
} else {
  mkdirSync(dirname(JSON_PATH), { recursive: true });
  writeFileSync(JSON_PATH, json);
  writeFileSync(MARKDOWN_PATH, markdown);
}

console.log([
  `total=${summary.total}`,
  `approximatePins=${summary.findings.approximate_pin ?? 0}`,
  `missingHours=${summary.findings.missing_hours ?? 0}`,
  `cachedKakao=${summary.findings.cached_kakao_match ?? 0}`,
  `naverEnglishUnchecked=${summary.byNaverEnglish.unchecked ?? 0}`,
  `uncheckedIdentity=${summary.byIdentity.unchecked ?? 0}`,
].join(" "));
