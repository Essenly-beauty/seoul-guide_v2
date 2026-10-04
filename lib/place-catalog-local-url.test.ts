import { describe, expect, it } from "vitest";
import { isLocalCatalogDatabaseUrl } from "../scripts/lib/local-catalog-database-url.mjs";

describe("local catalog database URL", () => {
  it("accepts only the configured local PostgreSQL port", () => {
    expect(isLocalCatalogDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres")).toBe(true);
    expect(isLocalCatalogDatabaseUrl("postgres://postgres:postgres@localhost:54322/postgres")).toBe(true);
    expect(isLocalCatalogDatabaseUrl("postgresql://u:p@db.example.com:54322/postgres")).toBe(false);
    expect(isLocalCatalogDatabaseUrl("postgresql://u:p@127.0.0.1:5432/postgres")).toBe(false);
    expect(isLocalCatalogDatabaseUrl("postgresql://u:p@127.0.0.1:54322/other")).toBe(false);
    expect(isLocalCatalogDatabaseUrl("https://127.0.0.1:54322/postgres")).toBe(false);
    expect(isLocalCatalogDatabaseUrl(undefined)).toBe(false);
  });
});
