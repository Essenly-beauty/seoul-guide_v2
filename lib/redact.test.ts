import { describe, expect, it } from "vitest";
import { redactSensitive } from "./redact";

/** OWASP Logging Cheat Sheet: never log session ids, access tokens or
 *  credentials. The client error reporter forwards raw browser error text
 *  (which can embed the current URL) to `client_errors`, so anything that
 *  looks like a token or an address must be masked before it leaves the tab. */
describe("redactSensitive", () => {
  it("masks token-like query parameters but keeps the parameter name", () => {
    const input = "Failed at https://x.app/auth/callback?code=abc123&next=%2Fmap&access_token=zzz";
    expect(redactSensitive(input)).toBe(
      "Failed at https://x.app/auth/callback?code=[redacted]&next=%2Fmap&access_token=[redacted]",
    );
  });

  it("masks tokens carried in a URL fragment", () => {
    expect(redactSensitive("at /reset#access_token=abc.def&refresh_token=ghi&type=recovery"))
      .toBe("at /reset#access_token=[redacted]&refresh_token=[redacted]&type=recovery");
  });

  it("masks e-mail addresses", () => {
    expect(redactSensitive("user someone.else+tag@example.co.kr not found"))
      .toBe("user [email] not found");
  });

  it("masks three-part JWTs", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactSensitive(`Bearer ${jwt} rejected`)).toBe("Bearer [jwt] rejected");
  });

  it("leaves ordinary error text and stack newlines untouched", () => {
    const stack = "TypeError: x is not a function\n    at map (app.js:1:2)\n    at run (app.js:3:4)";
    expect(redactSensitive(stack)).toBe(stack);
  });

  it("returns empty input unchanged", () => {
    expect(redactSensitive("")).toBe("");
  });
});
