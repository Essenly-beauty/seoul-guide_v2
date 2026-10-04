import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_PLACES, PLACES } from "../lib/data";
import { buildPlaceCatalogManifest } from "../lib/place-catalog-manifest";

const directory = join(process.cwd(), "scripts/.cache");
const path = join(directory, "place-catalog-manifest.json");
const text = JSON.stringify(buildPlaceCatalogManifest(CATALOGUE_PLACES, PLACES)) + "\n";

if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== text) throw new Error("place manifest is stale");
  console.log("place manifest matches current source and publication boundary");
} else {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path, text);
  console.log("wrote " + path);
}
