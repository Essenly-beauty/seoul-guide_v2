import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CATALOGUE_PLACES, PLACES } from "./data";

it("writes and verifies the current source and published manifest", () => {
  const root = process.cwd();
  const viteNode = join(root, "node_modules/.bin/vite-node");
  const args = ["--script", "scripts/export-place-catalog.ts"];
  execFileSync(viteNode, args, { cwd: root, stdio: "pipe" });

  const manifest = JSON.parse(readFileSync(
    join(root, "scripts/.cache/place-catalog-manifest.json"), "utf8",
  )) as { schemaVersion: number; sourceRows: unknown[]; publishedRows: unknown[] };
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.sourceRows).toHaveLength(CATALOGUE_PLACES.length);
  expect(manifest.publishedRows).toHaveLength(PLACES.length);
  expect(() => execFileSync(viteNode, [...args, "--check"], {
    cwd: root, stdio: "pipe",
  })).not.toThrow();
});
