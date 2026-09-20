import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_ERROR_KINDS } from "./client-error-kinds";

const ROOT = process.cwd();

/** The `kind` values the DB accepts, taken from the LAST migration that
 *  (re)defines the check on client_errors.kind — a kind the reporter sends
 *  but the constraint rejects is silently dropped by PostgREST. */
function acceptedKinds(): string[] {
  const dir = join(ROOT, "supabase/migrations");
  let latest: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, name), "utf8");
    if (!sql.includes("client_errors")) continue;
    const m = sql.match(/kind\s+in\s*\(([^)]*)\)/i);
    if (m) latest = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return latest;
}

describe("client_errors reporter ↔ schema contract", () => {
  it("every kind the reporter can send is accepted by the kind check constraint", () => {
    const accepted = acceptedKinds();
    for (const kind of CLIENT_ERROR_KINDS) expect(accepted).toContain(kind);
  });

  it("the reporter masks credentials in message and stack before inserting", () => {
    const src = readFileSync(join(ROOT, "lib/error-reporter.ts"), "utf8");
    expect(src).toMatch(/import \{ redactSensitive \} from "\.\/redact"/);
    expect(src).toMatch(/redactSensitive\(message/);
    expect(src).toMatch(/redactSensitive\(stack/);
  });
});
