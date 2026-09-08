import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUE_PLACES } from "../lib/data";
import {
  mergePlaceAuditBatches,
  parseHumanPlaceVerdictFile,
  parsePlaceAuditBatch,
  validatePlaceAuditBatchCoverage,
} from "../lib/place-audit-batch";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BATCH_DIRECTORY = join(ROOT, "data", "place-audit-batches");
const VERDICT_PATH = join(ROOT, "data", "place-audit-verdicts.json");
const TEMP_VERDICT_PATH = `${VERDICT_PATH}.tmp-${process.pid}`;

const batchFiles = (existsSync(BATCH_DIRECTORY)
  ? readdirSync(BATCH_DIRECTORY, { withFileTypes: true })
  : [])
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();

if (!batchFiles.length) {
  throw new Error(`No place audit batch JSON files found in ${BATCH_DIRECTORY}`);
}

const batches = batchFiles.map((filename) => {
  const path = join(BATCH_DIRECTORY, filename);
  try {
    // Native JSON parsing cannot report duplicate keys after they have been
    // collapsed. Detecting them reliably would require maintaining a JSON
    // tokenizer/parser; regex scanning would break on escaped strings. Batch
    // producers construct objects (so one file has unique keys), while the
    // merger explicitly rejects the meaningful duplicate case across files.
    return parsePlaceAuditBatch(JSON.parse(readFileSync(path, "utf8")), CATALOGUE_PLACES);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid place audit batch ${filename}: ${message}`);
  }
});

const base = parseHumanPlaceVerdictFile(JSON.parse(readFileSync(VERDICT_PATH, "utf8")));
validatePlaceAuditBatchCoverage(batches, CATALOGUE_PLACES, base);
const merged = mergePlaceAuditBatches(base, batches);
writeFileSync(TEMP_VERDICT_PATH, `${JSON.stringify(merged, null, 2)}\n`);
renameSync(TEMP_VERDICT_PATH, VERDICT_PATH);

const incomingCount = batches.reduce((count, batch) => count + Object.keys(batch.places).length, 0);
console.log([
  `batches=${batchFiles.length}`,
  `incomingPlaceVerdicts=${incomingCount}`,
  `finalPlaceVerdicts=${Object.keys(merged.places).length}`,
].join(" "));
