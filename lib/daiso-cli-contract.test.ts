import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DAISO_SNAPSHOT_PATH as BUILD_SNAPSHOT_PATH } from "../scripts/build-daiso-places";
import { DAISO_CANDIDATE_PATH } from "../scripts/collect-daiso-seoul";
import { DAISO_RANKING_GENERATED_PATH } from "../scripts/build-daiso-ranking";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("Daiso data CLI contracts", () => {
  it("runs the collection and build scripts in vite-node script mode", () => {
    expect(packageJson.scripts["collect:daiso-data"]).toBe(
      "vite-node --script scripts/collect-daiso-seoul.ts",
    );
    expect(packageJson.scripts["build:daiso-data"]).toBe(
      "vite-node --script scripts/build-daiso-places.ts",
    );
    expect(packageJson.scripts["build:daiso-ranking"]).toBe(
      "vite-node --script scripts/build-daiso-ranking.ts",
    );
  });

  it("keeps the default collection candidate separate from the immutable approved build source", () => {
    expect(DAISO_CANDIDATE_PATH).not.toBe(BUILD_SNAPSHOT_PATH);
    expect(DAISO_CANDIDATE_PATH).toMatch(/data\/candidates\/daiso-seoul-candidate\.json$/);
    expect(BUILD_SNAPSHOT_PATH).toMatch(/data\/sources\/daiso-seoul-2026-09-03\.json$/);
  });

  it("keeps ranking runtime data inside the repository", () => {
    expect(DAISO_RANKING_GENERATED_PATH).toMatch(/lib\/generated\/daiso-ranking-products\.ts$/);
    expect(DAISO_RANKING_GENERATED_PATH).not.toContain("Downloads");
  });
});
