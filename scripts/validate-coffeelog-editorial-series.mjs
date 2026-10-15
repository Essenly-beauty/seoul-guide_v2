import { readFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.join(process.cwd(), "data", "sources", "coffeelog-korea");
const labels = JSON.parse(await readFile(path.join(sourceDir, "research-labels-2026-09-26.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(sourceDir, "editorial-series-2026-10-15.json"), "utf8"));
const byCanonicalId = new Map(labels.records.map((record) => [record.canonical_place_id, record]));
const errors = [];
const seriesIds = new Set();

for (const series of manifest.series) {
  if (seriesIds.has(series.id)) errors.push(`Duplicate series id: ${series.id}`);
  seriesIds.add(series.id);
  if (series.places.length !== 6) errors.push(`${series.id}: expected 6 places, found ${series.places.length}`);

  const placeIds = new Set();
  for (const [index, place] of series.places.entries()) {
    if (placeIds.has(place.canonical_place_id)) errors.push(`${series.id}: duplicate place ${place.canonical_place_id}`);
    placeIds.add(place.canonical_place_id);
    if (place.order !== index + 1) errors.push(`${series.id}: invalid order for ${place.canonical_place_id}`);

    const research = byCanonicalId.get(place.canonical_place_id);
    if (!research) errors.push(`${series.id}: unknown canonical place ${place.canonical_place_id}`);
    else if (research.research_status !== "reviewed") errors.push(`${series.id}: ${place.canonical_place_id} is ${research.research_status}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const placements = manifest.series.reduce((sum, series) => sum + series.places.length, 0);
  console.log(`Validated ${manifest.series.length} editorial series and ${placements} place placements.`);
}
