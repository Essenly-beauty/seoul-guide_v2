import { describe, expect, it } from "vitest";
import { formatPhone, toE164 } from "./phone";

describe("toE164", () => {
  it("composes Korean mobile numbers (leading 0 dropped)", () => {
    expect(toE164("+82", "010-1234-5678")).toBe("+821012345678");
    expect(toE164("+82", "01012345678")).toBe("+821012345678");
  });
  it("keeps other countries' digits as-is", () => {
    expect(toE164("+1", "415 555 0134")).toBe("+14155550134");
    expect(toE164("+81", "090-1234-5678")).toBe("+819012345678");
  });
  it("rejects too-short and too-long input", () => {
    expect(toE164("+82", "1234")).toBeNull();
    expect(toE164("+82", "1234567890123456")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups for display", () => {
    expect(formatPhone("+821012345678")).toBe("+82 10-1234-5678");
  });
});

describe("smsProviderNotReady", () => {
  it("matches only owner-side configuration gaps", async () => {
    const { smsProviderNotReady } = await import("./phone");
    expect(smsProviderNotReady("Phone provider is disabled")).toBe(true);
    expect(smsProviderNotReady("SMS provider could not be found")).toBe(true);
    expect(smsProviderNotReady("Error finding SMS provider")).toBe(true);
    expect(smsProviderNotReady("Phone logins are not enabled")).toBe(true);
    // runtime failures stay actionable — never "feature doesn't exist"
    expect(smsProviderNotReady("Unsupported phone number format")).toBe(false);
    expect(smsProviderNotReady("Invalid 'To' phone number")).toBe(false);
    expect(smsProviderNotReady("For security purposes, you can only request this after 60 seconds")).toBe(false);
    expect(smsProviderNotReady("Error sending sms otp: carrier rejected")).toBe(false);
  });
});

describe("smsSendErrorCopy", () => {
  it("maps failure classes to actionable copy", async () => {
    const { smsSendErrorCopy } = await import("./phone");
    expect(smsSendErrorCopy("Invalid 'To' phone number")).toMatch(/doesn't look right/);
    expect(smsSendErrorCopy("For security purposes, you can only request this after 60 seconds")).toMatch(/wait a minute/);
    expect(smsSendErrorCopy("Twilio 30007 blocked")).toMatch(/try again in a moment/);
  });
});
