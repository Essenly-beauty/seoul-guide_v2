import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const modePage = source("app/onboarding/mode/page.tsx");
const registerClient = source("components/auth/register-client.tsx");
const basicsForm = source("components/onboarding/basics-form.tsx");
const phoneVerify = source("components/auth/phone-verify.tsx");

describe("launch onboarding flow", () => {
  it("starts new email accounts at the first of the three profile steps, without asking for a theme", () => {
    expect(modePage).toContain("redirect(routes.onboardingBasics)");
    expect(registerClient).toContain("router.push(routes.onboardingBasics)");
  });

  it("takes step one to the stated step two instead of the optional phone screen", () => {
    expect(basicsForm).toContain("href={routes.onboardingInterests}");
    expect(basicsForm).not.toContain("href={routes.onboardingPhone}");
  });

  it("does not invite a production user to send SMS until the service is enabled", () => {
    expect(phoneVerify).toContain("PHONE_VERIFICATION_AVAILABLE");
    expect(phoneVerify).toContain("Phone verification is coming soon");
  });
});
