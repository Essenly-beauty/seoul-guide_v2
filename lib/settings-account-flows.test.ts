import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const routes = source("lib/routes.ts");
const settings = source("app/settings/page.tsx");
const account = source("app/settings/account/page.tsx");
const namePage = source("app/settings/account/name/page.tsx");
const emailPage = source("app/settings/account/email/page.tsx");
const appPreferences = source("app/settings/app/page.tsx");
const privacy = source("app/settings/privacy/page.tsx");

describe("settings information architecture", () => {
  it("routes the settings hub to real category pages", () => {
    for (const route of [
      "settingsAccount",
      "settingsName",
      "settingsEmail",
      "settingsApp",
      "settingsPrivacy",
    ]) {
      expect(routes).toContain(`${route}:`);
    }
    expect(settings).toContain("routes.settingsAccount");
    expect(settings).toContain("routes.settingsApp");
    expect(settings).toContain("routes.settingsPrivacy");
    expect(settings).toContain("routes.onboardingProfile");
    expect(settings).toContain("routes.support");
  });

  it("does not present unsupported notification or phone controls in the main hub", () => {
    expect(settings).not.toContain("Notifications");
    expect(settings).not.toContain("Phone verification");
    expect(account).toContain("PHONE_VERIFICATION_AVAILABLE");
  });

  it("moves the existing real controls to focused detail pages", () => {
    expect(appPreferences).toContain("PwaInstallControl");
    expect(appPreferences).toContain("ThemeToggle");
    expect(appPreferences).toContain('id="location"');
    expect(privacy).toContain("AccountDataControls");
    expect(privacy).toContain("routes.legalTerms");
    expect(privacy).toContain("routes.legalPrivacy");
  });
});
describe("real account changes", () => {
  it("updates the authenticated user's display-name metadata", () => {
    expect(namePage).toContain("useAuthUser");
    expect(namePage).toContain("auth.updateUser");
    expect(namePage).toContain("...user.user_metadata");
    expect(namePage).toContain("full_name: nextName");
    expect(namePage).toContain("name: nextName");
    expect(namePage).toContain("Name updated.");
  });

  it("requests a confirmed email change and explains the pending state", () => {
    expect(emailPage).toContain("useAuthUser");
    expect(emailPage).toContain("auth.updateUser({ email: nextEmail })");
    expect(emailPage).toContain("Check both your current and new email inboxes");
    expect(emailPage).not.toContain("user.email =");
  });
});
