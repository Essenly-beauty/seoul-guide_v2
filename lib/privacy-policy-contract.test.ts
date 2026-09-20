import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** GDPR Art. 13 and Korea's PIPA (Art. 28-8 overseas transfer notice, Art. 30
 *  policy contents): a privacy notice must name the processors, say where
 *  data leaves the country, state retention, list the rights and how to
 *  exercise them, and name the supervisory authority. The page is plain
 *  strings, so this pins the presence of each element. */
describe("privacy policy contents", () => {
  const src = readFileSync(join(process.cwd(), "app/legal/privacy/page.tsx"), "utf8");
  it("names the processors and the overseas transfer", () => {
    for (const s of ["Supabase", "Vercel", "Google"]) expect(src).toContain(s);
    expect(src).toMatch(/outside (of )?Korea|international transfer|transferred/i);
  });
  it("states retention for diagnostics and the account", () => {
    expect(src).toMatch(/error reports|diagnostic/i);
    expect(src).toMatch(/\d+ (days|months)/);
  });
  it("lists the rights and how to exercise them, and the supervisory authorities", () => {
    expect(src).toMatch(/Settings → Data & privacy/);
    expect(src).toMatch(/Personal Information Protection Commission|PIPC/);
    expect(src).toMatch(/data protection authority/i);
  });
  it("explains the strictly necessary cookies and the local (on-device) storage", () => {
    expect(src).toMatch(/cookie/i);
    expect(src).toMatch(/localStorage|on your device|browser storage/i);
  });
});
