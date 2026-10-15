import { readFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.join(process.cwd(), "data", "sources", "coffeelog-korea");
const labels = JSON.parse(await readFile(path.join(sourceDir, "research-labels-2026-09-26.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(sourceDir, "editorial-series-2026-10-15.json"), "utf8"));
const checklists = await Promise.all([
  "publication-checklist-priority-1-3.json",
  "publication-checklist-priority-4-6.json",
  "publication-checklist-priority-7-8.json",
].map(async (filename) => JSON.parse(await readFile(path.join(sourceDir, filename), "utf8"))));
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

const publicationDrafts = checklists.reduce((sum, checklist) => sum + checklist.series.length, 0);
if (publicationDrafts !== manifest.series.length) errors.push(`Expected a draft for all ${manifest.series.length} series, found ${publicationDrafts}`);

for (const item of checklists.flatMap((checklist) => checklist.series)) {
  const series = manifest.series.find((candidate) => candidate.id === item.series_id);
  if (!series) {
    errors.push(`Checklist references unknown series: ${item.series_id}`);
    continue;
  }

  const expectedIds = series.places.map((place) => place.canonical_place_id);
  if (JSON.stringify(item.places) !== JSON.stringify(expectedIds)) {
    errors.push(`${item.series_id}: checklist places or order do not match the series manifest`);
  }

  try {
    const draft = await readFile(path.join(sourceDir, item.draft_path), "utf8");
    if (!draft.includes(`series_id: ${item.series_id}`)) errors.push(`${item.series_id}: draft frontmatter id mismatch`);
  } catch {
    errors.push(`${item.series_id}: missing draft ${item.draft_path}`);
  }

  if (item.draft_path_en) {
    try {
      const englishDraft = await readFile(path.join(sourceDir, item.draft_path_en), "utf8");
      if (!englishDraft.includes(`series_id: ${item.series_id}`)) errors.push(`${item.series_id}: English draft frontmatter id mismatch`);
      if ((englishDraft.match(/^## /gm) ?? []).length !== series.places.length) errors.push(`${item.series_id}: English draft place count mismatch`);
    } catch {
      errors.push(`${item.series_id}: missing English draft ${item.draft_path_en}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const placements = manifest.series.reduce((sum, series) => sum + series.places.length, 0);
  console.log(`Validated ${manifest.series.length} editorial series, ${placements} place placements, and ${publicationDrafts} publication drafts.`);
}
