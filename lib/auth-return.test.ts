import { describe, expect, it, vi } from "vitest";
import { authLinkWithNext, oauthCallbackUrl, passwordResetDestination, recoveryCallbackTarget, registrationDestination, safeAuthNext, signInFromRegistration } from "@/lib/auth-return";
import SignInPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import ResetPasswordPage from "@/app/reset-password/page";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/components/auth/login-client", () => ({ LoginClient: () => null }));
vi.mock("@/components/auth/register-client", () => ({ RegisterClient: () => null }));
vi.mock("@/components/auth/forgot-password-client", () => ({ ForgotPasswordClient: () => null }));
vi.mock("@/components/auth/reset-password-client", () => ({ ResetPasswordClient: () => null }));

const next = "/map?list=2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";

describe("safe auth return path", () => {
  it("keeps a same-origin path and query intact", () => {
    expect(safeAuthNext(next)).toBe(next);
  });

  it.each(["https://bad.example", "//bad.example/path", "/\\bad.example", "/map\u0000bad", "map"])(
    "rejects an unsafe destination %s",
    (raw) => expect(safeAuthNext(raw)).toBeNull(),
  );

  it("sends a new member through onboarding before the original shared link", () => {
    expect(registrationDestination(next)).toBe(`/onboarding/basics?next=${encodeURIComponent(next)}`);
    expect(registrationDestination(`/onboarding/basics?next=${encodeURIComponent(next)}`))
      .toBe(`/onboarding/basics?next=${encodeURIComponent(next)}`);
  });

  it("falls back safely for an unsafe registration destination", () => {
    expect(registrationDestination("//bad.example/path")).toBe("/onboarding/basics");
  });

  it("keeps the original shared link when switching from signup to sign-in", () => {
    const onboarding = registrationDestination(next);
    expect(new URL(signInFromRegistration(onboarding), "https://myseouldrop.app").searchParams.get("next"))
      .toBe(next);
    expect(new URL(signInFromRegistration(next), "https://myseouldrop.app").searchParams.get("next"))
      .toBe(next);
    expect(signInFromRegistration("//bad.example/path")).toBe("/login");
  });

  it("carries a safe return path through the Google callback", () => {
    expect(oauthCallbackUrl("https://myseouldrop.app", next))
      .toBe(`https://myseouldrop.app/auth/callback?next=${encodeURIComponent(next)}`);
    expect(oauthCallbackUrl("https://myseouldrop.app", "//bad.example"))
      .toBe("https://myseouldrop.app/auth/callback?next=%2Fmap");
  });

  it("carries a shared link through recovery but forces recovery links to the reset screen", () => {
    const reset = passwordResetDestination(next);
    expect(reset).toBe(`/reset-password?next=${encodeURIComponent(next)}`);
    expect(recoveryCallbackTarget(reset)).toBe(reset);
    expect(recoveryCallbackTarget(next)).toBe("/reset-password");
    expect(authLinkWithNext("/forgot-password", next))
      .toBe(`/forgot-password?next=${encodeURIComponent(next)}`);
    expect(authLinkWithNext("/forgot-password", "//bad.example"))
      .toBe("/forgot-password");
  });
});

describe("already signed-in auth pages", () => {
  it("returns a member from the sign-in page to the shared list", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "member" } } });
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });
    await expect(SignInPage({ searchParams: Promise.resolve({ next }) })).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith(next);
  });

  it("returns a member from the signup page to the shared list", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "member" } } });
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });
    await expect(RegisterPage({ searchParams: Promise.resolve({ next }) })).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith(next);
  });

  it("does not redirect an already signed-in member to an external origin", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "member" } } });
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });
    await expect(SignInPage({ searchParams: Promise.resolve({ next: "//bad.example" }) })).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/map");
  });
});

describe("signed-out auth pages", () => {
  it("passes the safe return path to the login client for Google OAuth", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const element = await SignInPage({ searchParams: Promise.resolve({ next }) });
    expect(element.props.next).toBe(next);
  });

  it("passes the registration destination to the signup client", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const onboarding = registrationDestination(next);
    const element = await RegisterPage({ searchParams: Promise.resolve({ next: onboarding }) });
    expect(element.props.next).toBe(onboarding);
  });

  it("passes the shared link through password recovery pages", async () => {
    const forgot = await ForgotPasswordPage({ searchParams: Promise.resolve({ next }) });
    const reset = await ResetPasswordPage({ searchParams: Promise.resolve({ next }) });
    expect(forgot.props.next).toBe(next);
    expect(reset.props.next).toBe(next);
  });
});
