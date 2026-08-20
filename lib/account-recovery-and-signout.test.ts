import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const optionalSource = (path: string) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};
const forgotPassword = source("app/forgot-password/page.tsx");
const resetPassword = source("app/reset-password/page.tsx");
const authCallback = source("app/auth/callback/route.ts");
const menuProfile = source("components/mypage/menu-profile.tsx");
const menuPage = source("app/menu/page.tsx");
const accountSettings = optionalSource("app/settings/account/page.tsx");
const hamburgerMenu = source("components/ui/hamburger-menu.tsx");
const signoutModal = source("components/ui/signout-modal.tsx");

describe("account recovery", () => {
  it("sends recovery links back to the password-reset screen after a PKCE exchange", () => {
    expect(forgotPassword).toContain("/auth/callback?next=${encodeURIComponent(routes.resetPassword)}");
    expect(authCallback).toContain("const target = otpType === \"recovery\" ? routes.resetPassword : next;");
    expect(authCallback).toContain("return NextResponse.redirect(new URL(next, url.origin));");
  });

  it("requires a matching confirmation before updating the password", () => {
    expect(resetPassword).toContain('const [confirmPw, setConfirmPw] = useState("");');
    expect(resetPassword).toContain("if (pw !== confirmPw)");
    expect(resetPassword).toContain("Passwords don't match");
    expect(resetPassword).toContain('placeholder="Confirm new password"');
  });
});

describe("sign out access", () => {
  it("nests sign out under Settings Account instead of presenting it on the My page", () => {
    expect(menuProfile).not.toContain("SignoutModal");
    expect(menuPage).not.toContain("SignoutModal");
    expect(accountSettings).toContain('import { SignoutModal } from "@/components/ui/signout-modal";');
    expect(accountSettings).toContain("<SignoutModal menuRow />");
    expect(signoutModal).toContain("menuRow?: boolean");
    expect(signoutModal).toContain('className="inforow signout-menu-row"');
    expect(signoutModal).toContain("auth.signOut()");
  });

  it("does not present a drawer action that only navigates without signing out", () => {
    expect(hamburgerMenu).not.toContain("router.push(routes.splash)");
    expect(hamburgerMenu).not.toContain("Sign out");
  });
});
