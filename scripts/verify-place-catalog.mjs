import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { compareCatalogRows } from "./lib/place-catalog-parity.mjs";
import { isLocalCatalogDatabaseUrl } from "./lib/local-catalog-database-url.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, part]) => [key, canonical(part)]));
  }
  return value;
}

const hash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const connectionString = process.env.PLACE_CATALOG_DATABASE_URL;
if (!isLocalCatalogDatabaseUrl(connectionString)) throw new Error("local database only");

const manifest = JSON.parse(readFileSync("scripts/.cache/place-catalog-manifest.json", "utf8"));
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const { rows } = await client.query(`select id, payload, payload_sha256
    from public.places where publication_state = 'published' order by id`);
  const expected = manifest.publishedRows.map((row) => ({ id: row.id, payload_sha256: row.sha256 }));
  const errors = compareCatalogRows(expected, rows);
  for (const row of rows) {
    if (hash(row.payload) !== row.payload_sha256) errors.push(`payload-hash:${row.id}`);
  }
  if (errors.length) throw new Error(`catalog parity failed: ${errors.slice(0, 20).join(", ")}`);
  console.log(`catalog parity passed: ${expected.length} published IDs and full payloads`);
} finally {
  await client.end();
}
