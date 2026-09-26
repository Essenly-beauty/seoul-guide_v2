import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.join(process.cwd(), "data", "sources", "coffeelog-korea");
const candidatesPath = path.join(sourceDir, "seoul-cafe-candidates-2026-09-22.json");
const outputPath = path.join(sourceDir, "research-queue-2026-09-26.json");
const payload = JSON.parse(await readFile(candidatesPath, "utf8"));

const normalize = (name) => name
  .normalize("NFKC")
  .replace(/\[[^\]]+\]/g, " ")
  .replace(/\([^)]*(?:동|역|구|서울숲|마포|성수|합정|망원|상수|한남|안국|광화문|잠실)[^)]*\)/g, " ")
  .replace(/[📍/–—]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase();

const nonCafePattern = /(붕어빵|잉어빵|도넛|베이크샵|케이크샵|베이커리|베이글|서점|책방)/;
const editorialPattern = /(로스터|커피|북|책|한강|라운지|작업실|음악감상|뷰|공원|정원|카페)/i;
const groups = new Map();
for (const record of payload.records) {
  const normalized = normalize(record.source_name);
  const key = `${record.district_ko}:${normalized}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record.external_id);
}

const records = payload.records.map((record) => {
  const normalized_name = normalize(record.source_name);
  const group = groups.get(`${record.district_ko}:${normalized_name}`);
  const content_kind_guess = nonCafePattern.test(record.source_name)
    ? "mixed_or_non_cafe_needs_review"
    : "cafe_candidate";
  const research_priority = record.research_status !== "not_researched"
    ? "done_or_pending_specific_check"
    : group.length > 1
      ? "p1_identity_dedup"
      : editorialPattern.test(record.source_name)
        ? "p2_editorial_potential"
        : "p3_general_review";
  return {
    external_id: record.external_id,
    source_name: record.source_name,
    district_ko: record.district_ko,
    normalized_name,
    possible_duplicate_external_ids: group.filter((id) => id !== record.external_id),
    content_kind_guess,
    research_priority,
    current_research_status: record.research_status,
  };
});

const summary = records.reduce((acc, record) => {
  acc[record.research_priority] = (acc[record.research_priority] ?? 0) + 1;
  return acc;
}, {});
await writeFile(outputPath, `${JSON.stringify({
  schema_version: "1.0.0",
  generated_on: "2026-09-26",
  caution: "이 파일은 전수 조사 큐다. 추정 필드는 공개용 태그가 아니며 사람 또는 출처 검토가 필요하다.",
  summary,
  records,
}, null, 2)}\n`);
console.log(`Wrote ${records.length} queue records.`, summary);
