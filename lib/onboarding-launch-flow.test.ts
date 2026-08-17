import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const modePage = source("app/onboarding/mode/page.tsx");
const registerClient = source("components/auth/register-client.tsx");
const basicsForm = source("components/onboarding/basics-form.tsx");
const phoneVerify = source("components/auth/phone-verify.tsx");

describe("launch onboarding flow", () => {
  it("starts new email accounts at the single optional onboarding screen, without asking for a theme", () => {
    expect(modePage).toContain("redirect(routes.onboardingBasics)");
    expect(registerClient).toContain("const onboardingTarget");
    expect(registerClient).toContain("router.push(onboardingTarget)");
  });

  it("keeps journey and interests together instead of continuing into a second step or phone screen", () => {
    expect(basicsForm).toContain('questionFor("stayType")');
    expect(basicsForm).toContain("What are you interested in?");
    expect(basicsForm).toContain("Personalize my Seoul Drop");
    expect(basicsForm).toContain("Skip");
    expect(basicsForm).not.toContain("Step 1");
    expect(basicsForm).not.toContain("routes.onboardingInterests");
    expect(basicsForm).not.toContain("href={routes.onboardingPhone}");
  });

  it("does not invite a production user to send SMS until the service is enabled", () => {
    expect(phoneVerify).toContain("PHONE_VERIFICATION_AVAILABLE");
    expect(phoneVerify).toContain("Phone verification is coming soon");
  });
});
