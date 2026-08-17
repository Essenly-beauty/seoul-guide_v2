import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registerClient = readFileSync(new URL("../components/auth/register-client.tsx", import.meta.url), "utf8");

describe("email signup policy", () => {
  it("sets the expectation that a new account starts immediately at the first onboarding step", () => {
    expect(registerClient).toContain("start saving places right away");
    expect(registerClient).toContain("if (data.session)");
    expect(registerClient).toContain("router.push(routes.onboardingBasics)");
  });
});
