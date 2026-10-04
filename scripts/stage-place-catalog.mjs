import { readFileSync } from "node:fs";
import pg from "pg";
import { isLocalCatalogDatabaseUrl } from "./lib/local-catalog-database-url.mjs";

const connectionString = process.env.PLACE_CATALOG_DATABASE_URL;
if (!connectionString) throw new Error("PLACE_CATALOG_DATABASE_URL is required");
if (!isLocalCatalogDatabaseUrl(connectionString)) throw new Error("local database only");

const manifest = JSON.parse(readFileSync("scripts/.cache/place-catalog-manifest.json", "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.sourceRows)
  || !Array.isArray(manifest.publishedRows)) throw new Error("invalid manifest");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  await client.query(`insert into internal.place_source_records
    (place_id, source_name, payload, payload_sha256)
    select id, source, payload, sha256
    from jsonb_to_recordset($1::jsonb)
      as incoming(id text, source text, payload jsonb, sha256 text)
    on conflict (place_id, source_name, payload_sha256) do nothing`,
    [JSON.stringify(manifest.sourceRows)]);
  await client.query(`insert into public.places
    (id, type, zone, name, name_kr, address, lat, lng, publication_state,
     business_state, payload, payload_sha256)
    select id, payload->>'type', payload->>'zone', payload->>'name',
      payload->>'nameKr', payload->>'address', (payload->>'lat')::double precision,
      (payload->>'lng')::double precision, 'published', 'unknown', payload, sha256
    from jsonb_to_recordset($1::jsonb)
      as incoming(id text, payload jsonb, sha256 text)
    on conflict (id) do update set
      type = excluded.type, zone = excluded.zone, name = excluded.name,
      name_kr = excluded.name_kr, address = excluded.address,
      lat = excluded.lat, lng = excluded.lng, payload = excluded.payload,
      payload_sha256 = excluded.payload_sha256, updated_at = now()
    where public.places.payload_sha256 is distinct from excluded.payload_sha256`,
    [JSON.stringify(manifest.publishedRows)]);
  await client.query("commit");
  console.log(`staged ${manifest.sourceRows.length} source and ${manifest.publishedRows.length} published rows`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
