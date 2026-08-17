import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const menuProfile = source("components/mypage/menu-profile.tsx");
const signInNudge = source("components/auth/signin-nudge.tsx");
const menuPage = source("app/menu/page.tsx");
const auth = source("lib/auth/use-auth.ts");

describe("visitor mode", () => {
  it("describes an unauthenticated person as a visitor with device-local saves, not a guest account", () => {
    expect(menuProfile).toContain("Keep your Seoul picks");
    expect(menuProfile).toContain("Explore freely — saved places stay on this device until you sign in.");
    expect(auth).toContain('return "Visitor";');
  });

  it("keeps the dismissible sign-up prompt while letting the visitor continue exploring", () => {
    expect(signInNudge).toContain("Keep exploring");
    expect(signInNudge).not.toContain("Continue as guest");
    expect(menuPage).toContain('if (!authLoading && !user) nudge("menu");');
  });
});
