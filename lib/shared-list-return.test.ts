import { describe, expect, it } from "vitest";
import { registerForSharedList, sharedListReturnPath, signInForSharedList } from "@/lib/shared-list-return";

const id = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";

describe("shared-list authentication return", () => {
  it("preserves the list URL in the sign-in destination", () => {
    expect(sharedListReturnPath(id)).toBe(`/map?list=${id}`);
    const signIn = new URL(signInForSharedList(id), "https://myseouldrop.app");
    expect(signIn.pathname).toBe("/login");
    expect(signIn.searchParams.get("next")).toBe(`/map?list=${id}`);
  });

  it("sends signup through onboarding and then to the same list", () => {
    const register = new URL(registerForSharedList(id), "https://myseouldrop.app");
    expect(register.pathname).toBe("/register");
    const onboarding = new URL(register.searchParams.get("next")!, "https://myseouldrop.app");
    expect(onboarding.pathname).toBe("/onboarding/basics");
    expect(onboarding.searchParams.get("next")).toBe(`/map?list=${id}`);
  });

  it("rejects invalid IDs rather than putting them in an auth redirect", () => {
    expect(() => signInForSharedList("//bad.example/path")).toThrow();
    expect(() => registerForSharedList("not-a-uuid")).toThrow();
  });
});
