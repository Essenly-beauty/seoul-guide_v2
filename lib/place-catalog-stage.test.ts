import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { isLocalCatalogDatabaseUrl } from "../scripts/lib/local-catalog-database-url.mjs";

const localDatabaseUrl = isLocalCatalogDatabaseUrl(process.env.PLACE_CATALOG_DATABASE_URL)
  ? process.env.PLACE_CATALOG_DATABASE_URL : undefined;

describe("catalog staging safety", () => {
  it("rejects a non-loopback database before connecting", () => {
    const result = spawnSync(process.execPath, ["scripts/stage-place-catalog.mjs"], {
      env: { ...process.env, PLACE_CATALOG_DATABASE_URL: "postgresql://u:p@db.example.com:54322/postgres" },
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("local database only");
  });

  it("rejects a different local Postgres port", () => {
    const result = spawnSync(process.execPath, ["scripts/stage-place-catalog.mjs"], {
      env: { ...process.env, PLACE_CATALOG_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/postgres" },
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("local database only");
  });

  it.skipIf(!localDatabaseUrl)("stages published places idempotently in the local DB", async () => {
    const manifest = JSON.parse(readFileSync("scripts/.cache/place-catalog-manifest.json", "utf8"));
    const client = new pg.Client({ connectionString: localDatabaseUrl });
    await client.connect();
    try {
      for (let run = 0; run < 2; run += 1) {
        const result = spawnSync(process.execPath, ["scripts/stage-place-catalog.mjs"], {
          env: process.env,
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(0);
        const sources = await client.query("select count(*)::int as count from internal.place_source_records");
        const published = await client.query("select count(*)::int as count from public.places where publication_state = 'published'");
        expect(sources.rows[0].count).toBe(manifest.sourceRows.length);
        expect(published.rows[0].count).toBe(manifest.publishedRows.length);
      }
    } finally {
      await client.end();
    }
  });
});
