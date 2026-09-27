import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.join(process.cwd(), "data", "sources", "coffeelog-korea");
const candidatesPath = path.join(sourceDir, "seoul-cafe-candidates-2026-09-22.json");
const researchPath = path.join(sourceDir, "research-labels-2026-09-26.json");
const candidates = JSON.parse(await readFile(candidatesPath, "utf8"));
const research = JSON.parse(await readFile(researchPath, "utf8"));
const byExternalId = new Map();

for (const item of research.records) for (const id of item.member_external_ids) {
  if (byExternalId.has(id)) throw new Error(`Duplicate research mapping: ${id}`);
  byExternalId.set(id, item);
}

let applied = 0;
candidates.schema_version = "1.2.0";
candidates.research_policy = { labels_manifest: "./research-labels-2026-09-26.json", researched_labels_are_not_endorsements: true };
candidates.records = candidates.records.map((record) => {
  const item = byExternalId.get(record.external_id);
  if (!item) return { ...record, canonical_place_id: record.canonical_place_id ?? null, research_status: record.research_status ?? "not_researched" };
  applied += 1;
  return { ...record, canonical_place_id: item.canonical_place_id, research_status: item.research_status, research_confidence: item.confidence, verified_attributes: item.verified_attributes, ados_editorial_angles: item.ados_editorial_angles, research_cautions: item.cautions, research_evidence: item.evidence };
});
const known = new Set(candidates.records.map((record) => record.external_id));
const missing = [...byExternalId.keys()].filter((id) => !known.has(id));
if (missing.length) throw new Error(`Unknown external IDs: ${missing.join(", ")}`);
candidates.scope.researched_record_count = applied;
await writeFile(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
console.log(`Applied research to ${applied} source records across ${research.records.length} canonical places.`);
