import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registerPage = readFileSync(new URL("../app/register/page.tsx", import.meta.url), "utf8");
const loginClient = readFileSync(new URL("../components/auth/login-client.tsx", import.meta.url), "utf8");

describe("account-switch registration", () => {
  it("keeps the registration form reachable for an already signed-in visitor who chooses to switch accounts", () => {
    expect(registerPage).toContain('if (params.switch !== "1")');
  });

  it("keeps the switch intent when the sign-in screen links to account creation", () => {
    expect(loginClient).toContain('searchParams.get("switch")');
    expect(loginClient).toContain('params.set("switch", "1")');
  });
});
