import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoginClient } from "@/components/auth/login-client";
import { RegisterClient } from "@/components/auth/register-client";
import { registrationDestination } from "@/lib/auth-return";
import { readFileSync } from "node:fs";

const id = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";
const next = `/map?list=${id}`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ next }),
}));
vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: ({ children, foot, oauthNext }: { children: ReactNode; foot?: ReactNode; oauthNext?: string }) => (
    <div data-oauth-next={oauthNext}>{children}{foot}</div>
  ),
}));

describe("shared-link auth screen wiring", () => {
  it("passes the shared link to Google login", () => {
    const html = renderToStaticMarkup(createElement(LoginClient, { next }));
    expect(html).toContain(`data-oauth-next="${next}"`);
    expect(html).toContain(`href="/forgot-password?next=%2Fmap%3Flist%3D${id}"`);
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
