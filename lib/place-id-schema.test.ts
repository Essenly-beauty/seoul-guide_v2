import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES } from "./data";

const migrationDir = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(migrationDir, name), "utf8"))
  .join("\n");

function latestPlaceIdLimit(column: "place_id" | "item_id"): number {
  const pattern = new RegExp(`char_length\\(${column}\\)\\s+between\\s+1\\s+and\\s+(\\d+)`, "gi");
  const limits = [...migrations.matchAll(pattern)].map((match) => Number(match[1]));
  return limits.at(-1) ?? 0;
}

describe("published place IDs versus account storage schema", () => {
  const longestPublishedPlaceId = Math.max(...PLACES.map((place) => place.id.length));

  it("allows every published place ID in account ratings", () => {
    expect(latestPlaceIdLimit("place_id")).toBeGreaterThanOrEqual(longestPublishedPlaceId);
  });

  it("allows every published place ID in account favorites", () => {
    expect(latestPlaceIdLimit("item_id")).toBeGreaterThanOrEqual(longestPublishedPlaceId);
  });
});
