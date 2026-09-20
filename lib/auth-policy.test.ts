import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES, passwordProblem } from "./auth-policy";

/** NIST SP 800-63B-4 (2025-08) §3.1.1: at least 8 characters when the
 *  password is one factor, 64+ allowed, NO composition rules; Supabase's own
 *  guidance says anything under 8 is not recommended. bcrypt (Supabase Auth)
 *  ignores bytes past 72, so a longer secret must be refused, not truncated. */
describe("password policy", () => {
  it("requires at least 8 characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
    expect(passwordProblem("a".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(/at least \d+ characters/);
    expect(passwordProblem("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it("imposes no composition rules — a long all-lowercase passphrase is fine", () => {
    expect(passwordProblem("correct horse battery staple")).toBeNull();
  });

  it("refuses secrets bcrypt would silently truncate (72 bytes), counting UTF-8 bytes", () => {
    expect(PASSWORD_MAX_BYTES).toBe(72);
    expect(passwordProblem("a".repeat(72))).toBeNull();
    expect(passwordProblem("a".repeat(73))).toMatch(/too long/i);
    // 25 Hangul syllables = 75 bytes in UTF-8 though only 25 characters
    expect(passwordProblem("가".repeat(25))).toMatch(/too long/i);
  });

  it("is what the sign-up and reset forms enforce (no stale minLength={6})", () => {
    for (const path of ["components/auth/register-client.tsx", "app/reset-password/page.tsx"]) {
      const src = readFileSync(join(process.cwd(), path), "utf8");
      expect(src, path).not.toMatch(/minLength=\{6\}/);
      expect(src, path).toMatch(/PASSWORD_MIN_LENGTH/);
      expect(src, path).toMatch(/passwordProblem\(/);
    }
  });
});
