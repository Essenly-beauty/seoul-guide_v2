import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginClient } from "@/components/auth/login-client";
import { RegisterClient } from "@/components/auth/register-client";
import { registrationDestination } from "@/lib/auth-return";
import { readFileSync } from "node:fs";

const id = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";
const next = `/map?list=${id}`;
let query = new URLSearchParams({ next });

beforeEach(() => { query = new URLSearchParams({ next }); });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => query,
}));
vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: ({ children, cta, foot, oauthNext }: { children: ReactNode; cta?: ReactNode; foot?: ReactNode; oauthNext?: string }) => (
    <div data-oauth-next={oauthNext}>{children}{cta}{foot}</div>
  ),
}));

describe("shared-link auth screen wiring", () => {
  it("passes the shared link to Google login", () => {
    const html = renderToStaticMarkup(createElement(LoginClient, { next }));
    expect(html).toContain(`data-oauth-next="${next}"`);
    expect(html).toContain(`href="/forgot-password?next=%2Fmap%3Flist%3D${id}"`);
  });

  it("keeps My as the return destination for password recovery and account creation", () => {
    query = new URLSearchParams({ next: "/menu", switch: "1" });
    const html = renderToStaticMarkup(createElement(LoginClient, { next: "/menu" }));
    expect(html).toContain('href="/forgot-password?next=%2Fmenu"');
    expect(html).toContain('href="/register?next=%2Fmenu&amp;switch=1"');
    expect(html).toContain('for="signin-email">Email</label>');
    expect(html).toContain('for="signin-password">Password</label>');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('aria-label="Show password"');
  });

  it("associates callback errors with the fields and renders unknown error codes safely", () => {
    query = new URLSearchParams({ next: "/menu", error: "constructor" });
    const html = renderToStaticMarkup(createElement(LoginClient, { next: "/menu" }));
    expect(html).toContain('id="signin-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-describedby="signin-error"');
    expect(html).toContain("That sign-in link didn&#x27;t work");
  });

  it("passes onboarding to Google signup and preserves the original link on Sign in", () => {
    const onboarding = registrationDestination(next);
    const html = renderToStaticMarkup(createElement(RegisterClient, { next: onboarding }));
    expect(html).toContain(`data-oauth-next="${onboarding}"`);
    expect(html).toContain(`href="/login?next=%2Fmap%3Flist%3D${id}"`);
    expect(html).not.toContain('href="/login"');
    const signupSource = readFileSync(new URL("../components/auth/register-client.tsx", import.meta.url), "utf8");
    expect(signupSource).toMatch(/if \(sentTo\) \{[\s\S]*?title="Check your email"\s+oauthNext=\{onboardingTarget\}/);
  });
});
