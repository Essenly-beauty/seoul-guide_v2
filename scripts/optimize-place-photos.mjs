#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

export const MAX_EDGE = 1080;
export const WEBP_QUALITY = 80;
// A map-row image is 84 CSS pixels. 320px stays crisp at 3x DPR without
// making every offscreen row download the 1080px detail asset.
export const THUMBNAIL_EDGE = 320;
export const THUMBNAIL_WEBP_QUALITY = 72;
const IMAGE_EXTENSION = /\.(?:avif|jpe?g|png|webp)$/i;

export function validatePlacePhotoAliases(manifest, knownPlaceIds) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.aliases)) {
    throw new Error("Unsupported place photo alias manifest");
  }

  const aliases = new Map();
  const claimedTargets = new Set();
  for (const entry of manifest.aliases) {
    const sourcePlaceId = entry?.sourcePlaceId?.trim();
    const targetPlaceId = entry?.targetPlaceId?.trim();
    if (!sourcePlaceId || !targetPlaceId || sourcePlaceId === targetPlaceId) {
      throw new Error("Each photo alias needs distinct sourcePlaceId and targetPlaceId values");
    }
    if (aliases.has(sourcePlaceId)) throw new Error(`Duplicate photo alias source: ${sourcePlaceId}`);
    if (claimedTargets.has(targetPlaceId)) throw new Error(`Duplicate photo alias target: ${targetPlaceId}`);
    if (!knownPlaceIds.has(targetPlaceId)) throw new Error(`Unknown canonical place: ${targetPlaceId}`);
    if (typeof entry.reason !== "string" || !entry.reason.trim()) {
      throw new Error(`Missing photo alias reason: ${sourcePlaceId}`);
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0 ||
        entry.evidence.some((url) => typeof url !== "string" || !/^https:\/\//.test(url))) {
      throw new Error(`Missing direct photo alias evidence: ${sourcePlaceId}`);
    }
    aliases.set(sourcePlaceId, targetPlaceId);
    claimedTargets.add(targetPlaceId);
  }
  return aliases;
}

function thumbnailPathFor(outputPath) {
  const extension = extname(outputPath);
  return `${outputPath.slice(0, -extension.length)}.thumb.webp`;
}

export async function optimizePlacePhoto(inputPath, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  const inputBytes = (await stat(inputPath)).size;
  const thumbnailOutputPath = thumbnailPathFor(outputPath);
  const source = sharp(inputPath, { failOn: "warning" }).rotate();

  await Promise.all([
    source
      .clone()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toFile(outputPath),
    source
      .clone()
      .resize({
        width: THUMBNAIL_EDGE,
        height: THUMBNAIL_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_WEBP_QUALITY, effort: 5 })
      .toFile(thumbnailOutputPath),
  ]);

  const outputBytes = (await stat(outputPath)).size;
  const thumbnailBytes = (await stat(thumbnailOutputPath)).size;
  return {
    inputPath,
    outputPath,
    thumbnailOutputPath,
    inputBytes,
    outputBytes,
    thumbnailBytes,
  };
}

function naturalSort(a, b) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export async function optimizePlacePhotoTree(inputRoot, outputRoot, options = {}) {
  const { allowedPlaceIds, placeIdAliases = new Map() } = options;
  const results = [];
  const nextIndexByPlaceId = new Map();
  const placeEntries = (await readdir(inputRoot, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (!allowedPlaceIds || allowedPlaceIds.has(placeIdAliases.get(entry.name) ?? entry.name)),
    )
    .sort((a, b) => naturalSort(a.name, b.name));

  for (const placeEntry of placeEntries) {
    const placeId = placeIdAliases.get(placeEntry.name) ?? placeEntry.name;
    const inputDir = join(inputRoot, placeEntry.name);
    const files = (await readdir(inputDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && IMAGE_EXTENSION.test(entry.name))
      .map((entry) => entry.name)
      .sort(naturalSort);

    for (const [index, file] of files.entries()) {
      const outputIndex = (nextIndexByPlaceId.get(placeId) ?? 0) + index + 1;
      const result = await optimizePlacePhoto(
        join(inputDir, file),
        join(outputRoot, placeId, `${outputIndex}.webp`),
      );
      results.push({ ...result, placeId, sourcePlaceId: placeEntry.name, sourceFile: file });
    }
    nextIndexByPlaceId.set(placeId, (nextIndexByPlaceId.get(placeId) ?? 0) + files.length);
  }

  return results;
}

export async function readApplicationPlaceIds(root) {
  const knownIds = new Set();
  const sources = [
    join(root, "lib", "data.ts"),
    join(root, "lib", "generated", "creatrip-places.ts"),
    join(root, "lib", "generated", "oliveyoung-places.ts"),
    join(root, "lib", "generated", "ados-places.ts"),
    join(root, "lib", "generated", "ados-photo-places.ts"),
    join(root, "lib", "generated", "ados-photo-provisional-places.ts"),
  ];
  for (const source of sources) {
    const text = await readFile(source, "utf8");
    for (const match of text.matchAll(/\b"?id"?\s*:\s*"([^"]+)"/g)) knownIds.add(match[1]);
  }
  return knownIds;
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
  const inputRoot = resolve(args.input ?? join(root, "scripts", ".cache", "place-photo-downloads"));
  const outputRoot = resolve(args.output ?? join(root, "public", "places"));
  const reportPath = resolve(args.report ?? join(root, "scripts", ".cache", "place-photo-optimization.json"));
  const knownPlaceIds = await readApplicationPlaceIds(root);
  const aliasManifestPath = resolve(args.aliases ?? join(root, "data", "place-photo-aliases.json"));
  const aliasManifest = JSON.parse(await readFile(aliasManifestPath, "utf8"));
  const placeIdAliases = validatePlacePhotoAliases(aliasManifest, knownPlaceIds);
  const allowedPlaceIds = args["known-only"] === "true" ? knownPlaceIds : undefined;
  const results = await optimizePlacePhotoTree(inputRoot, outputRoot, {
    allowedPlaceIds,
    placeIdAliases,
  });
  const inputBytes = results.reduce((total, item) => total + item.inputBytes, 0);
  const outputBytes = results.reduce((total, item) => total + item.outputBytes, 0);
  const thumbnailBytes = results.reduce((total, item) => total + item.thumbnailBytes, 0);
  const places = new Set(results.map((item) => item.placeId)).size;

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify({ places, photos: results.length, inputBytes, outputBytes, thumbnailBytes, results }, null, 2)}\n`,
  );

  const savedPercent = inputBytes === 0 ? 0 : Math.round((1 - outputBytes / inputBytes) * 100);
  console.log(
    `${results.length} photos across ${places} places: ${Math.round(inputBytes / 1000)}KB → ${Math.round(outputBytes / 1000)}KB (${savedPercent}% smaller)`,
  );
  console.log(`list thumbnails: ${Math.round(thumbnailBytes / 1000)}KB total`);
  console.log(`report: ${basename(reportPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
