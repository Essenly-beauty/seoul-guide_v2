#!/usr/bin/env node
// Olive Young official store photos → optimizer staging tree.
//
// The owner compiled one representative image per Seoul store from the
// Olive Young store finder (Drive folder + spreadsheet, 2026-09-18). Which
// store belongs to which catalogue place is a reviewed decision, so it lives
// in data/oliveyoung-store-photos.json rather than being re-derived here.
// This script only lays the files out the way optimize-place-photos.mjs
// expects, and refuses anything the manifest does not vouch for.
//
//   1. Extract the Drive ZIP (photos/<CODE>_<store>.webp)
//   2. node scripts/stage-oliveyoung-photos.mjs --photos <extracted>/photos
//   3. node scripts/optimize-place-photos.mjs \
//        --input scripts/.cache/oliveyoung-photo-downloads \
//        --report scripts/.cache/oliveyoung-photo-optimization.json \
//        --known-only true
//   4. node scripts/build-place-photos.mjs

import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readApplicationPlaceIds } from "./optimize-place-photos.mjs";

export function planOliveYoungPhotoStaging(manifest, availableFiles, knownPlaceIds) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.photos)) {
    throw new Error("Unsupported Olive Young photo manifest");
  }
  const files = new Set([...availableFiles].map((name) => name.normalize("NFC")));
  const seenPlaces = new Map();
  const plan = [];
  for (const entry of manifest.photos) {
    const placeId = entry?.placeId?.normalize("NFC");
    const file = entry?.file?.normalize("NFC");
    if (!placeId || !file) throw new Error(`Manifest entry ${entry?.storeCode ?? "?"} needs placeId and file`);
    if (!knownPlaceIds.has(placeId)) throw new Error(`Unknown catalogue place: ${placeId} (${entry.storeCode})`);
    if (seenPlaces.has(placeId)) {
      throw new Error(`Two stores map to ${placeId}: ${seenPlaces.get(placeId)} and ${entry.storeCode}`);
    }
    if (!files.has(file)) throw new Error(`Photo missing from the archive: ${file}`);
    seenPlaces.set(placeId, entry.storeCode);
    plan.push({ storeCode: entry.storeCode, placeId, sourceFile: file, targetFile: "1.webp" });
  }
  return plan;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`Invalid argument: ${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  return args;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = parseArgs(process.argv.slice(2));
  if (!args.photos) throw new Error("--photos <dir with CODE_store.webp files> is required");
  const photosDir = resolve(args.photos);
  const outputRoot = resolve(args.output ?? join(root, "scripts", ".cache", "oliveyoung-photo-downloads"));
  const manifestPath = resolve(args.manifest ?? join(root, "data", "oliveyoung-store-photos.json"));

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const knownPlaceIds = await readApplicationPlaceIds(root);
  const available = (await readdir(photosDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const plan = planOliveYoungPhotoStaging(manifest, available, knownPlaceIds);

  await rm(outputRoot, { recursive: true, force: true });
  for (const step of plan) {
    const targetDir = join(outputRoot, step.placeId);
    await mkdir(targetDir, { recursive: true });
    await copyFile(join(photosDir, step.sourceFile), join(targetDir, step.targetFile));
  }
  console.log(`${plan.length} store photos staged under ${outputRoot}`);
  console.log(`${manifest.excluded?.length ?? 0} archive images deliberately left out (see manifest.excluded)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
