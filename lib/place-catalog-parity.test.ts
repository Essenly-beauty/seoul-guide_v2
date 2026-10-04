import { spawnSync } from "node:child_process";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { compareCatalogRows } from "../scripts/lib/place-catalog-parity.mjs";
import { isLocalCatalogDatabaseUrl } from "../scripts/lib/local-catalog-database-url.mjs";

const localDatabaseUrl = isLocalCatalogDatabaseUrl(process.env.PLACE_CATALOG_DATABASE_URL)
  ? process.env.PLACE_CATALOG_DATABASE_URL : undefined;

describe("catalog parity", () => {
  const expected = [{ id: "a", payload_sha256: "1" }];

  it("passes exact matches", () => {
    expect(compareCatalogRows(expected, expected)).toEqual([]);
  });

  it("reports missing, extra, and changed rows", () => {
    expect(compareCatalogRows(expected, [
      { id: "a", payload_sha256: "2" },
      { id: "b", payload_sha256: "3" },
    ])).toEqual(["changed:a", "extra:b"]);
    expect(compareCatalogRows(expected, [])).toEqual(["missing:a"]);
  });

  it.skipIf(!localDatabaseUrl)("detects an extra published row with a mismatched payload hash", async () => {
    const client = new pg.Client({ connectionString: localDatabaseUrl });
    await client.connect();
    const runVerifier = () => spawnSync(process.execPath, ["scripts/verify-place-catalog.mjs"], {
      env: process.env,
      encoding: "utf8",
    });

    try {
      const clean = runVerifier();
      expect(clean.status, clean.stderr).toBe(0);

      await client.query(`insert into public.places
        (id, type, zone, name, name_kr, address, lat, lng, publication_state, payload, payload_sha256)
        values ('catalog-parity-injected', 'daiso', 'gangnam_station', 'Injected', '검증용',
          '서울 강남구 1', 37.5, 127, 'published', '{"id":"catalog-parity-injected"}'::jsonb,
          repeat('0', 64))`);

      const changed = runVerifier();
      expect(changed.status).not.toBe(0);
      expect(changed.stderr).toContain("extra:catalog-parity-injected");
      expect(changed.stderr).toContain("payload-hash:catalog-parity-injected");
    } finally {
      await client.query("delete from public.places where id = 'catalog-parity-injected'");
      await client.end();
    }
  });
});
