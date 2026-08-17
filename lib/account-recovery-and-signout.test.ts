import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const forgotPassword = source("app/forgot-password/page.tsx");
const authCallback = source("app/auth/callback/route.ts");
const menuProfile = source("components/mypage/menu-profile.tsx");
const hamburgerMenu = source("components/ui/hamburger-menu.tsx");
const signoutModal = source("components/ui/signout-modal.tsx");

describe("account recovery", () => {
  it("sends recovery links back to the password-reset screen after a PKCE exchange", () => {
    expect(forgotPassword).toContain("/auth/callback?next=${encodeURIComponent(routes.resetPassword)}");
    expect(authCallback).toContain("const target = otpType === \"recovery\" ? routes.resetPassword : next;");
    expect(authCallback).toContain("return NextResponse.redirect(new URL(next, url.origin));");
  });
});

describe("sign out access", () => {
  it("keeps a confirmed, real sign-out action in the My profile header", () => {
    expect(menuProfile).toContain('import { SignoutModal } from "@/components/ui/signout-modal";');
    expect(menuProfile).toContain("<SignoutModal compact />");
    expect(signoutModal).toContain("auth.signOut()");
  });

  it("does not present a drawer action that only navigates without signing out", () => {
    expect(hamburgerMenu).not.toContain("router.push(routes.splash)");
    expect(hamburgerMenu).not.toContain("Sign out");
  });
});
