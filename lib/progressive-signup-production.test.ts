import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const optionalSource = (path: string) => {
  try {
    return source(path);
  } catch {
    return "";
  }
};

const nudge = source("components/auth/signin-nudge.tsx");
const signIn = source("components/auth/login-client.tsx");
const basics = source("components/onboarding/basics-form.tsx");
const returnFlow = optionalSource("lib/signup-return.ts");
const menu = source("app/menu/page.tsx");
const beautyProfile = source("app/onboarding/beauty-profile/page.tsx");

describe("production progressive sign-up", () => {
  it("returns real Google and email sign-ups to optional onboarding before the original destination", () => {
    expect(nudge).toContain("routes.onboardingBasics");
    expect(nudge).toContain("returnTo");
    expect(basics).toContain("nextTarget");
  });

  it("keeps a saved place as one operation and shows one named success message after return", () => {
    expect(returnFlow).toContain("setPendingFavoriteReturn");
    expect(returnFlow).toContain("takePendingFavoriteReturn");
    expect(returnFlow).toContain("saved. Added to My Seoul Drop");
  });

  it("lets an unconfirmed email address request another signup confirmation from sign-in", () => {
    expect(signIn).toContain('type: "signup"');
    expect(signIn).toContain("Resend confirmation email");
    expect(signIn).toContain("Email not confirmed");
  });

  it("keeps beauty details out of onboarding but available from My after signup", () => {
    expect(menu).toContain("href: routes.onboardingProfile");
    expect(beautyProfile).toContain("<ProfileCard />");
    expect(beautyProfile).not.toContain("Step 3 of 3");
  });
});
