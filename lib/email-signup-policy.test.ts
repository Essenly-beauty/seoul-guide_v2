import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registerClient = readFileSync(new URL("../components/auth/register-client.tsx", import.meta.url), "utf8");

describe("email signup policy", () => {
  it("sends a new account through the optional onboarding screen after sign-up", () => {
    expect(registerClient).toContain("start saving places right away");
    expect(registerClient).toContain("if (data.session)");
    expect(registerClient).toContain("router.push(onboardingTarget)");
  });
});
