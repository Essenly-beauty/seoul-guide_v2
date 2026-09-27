import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_VALUE_MOMENTS, shouldOfferInstall, type InstallNudgeState } from "./install-nudge-policy";

// Owner decision 2026-09-27: offer the Home Screen install, but only after the
// visitor has got something out of the app. Installing is what removes the
// browser's own header and footer, and until now the only way to find that out
// was the hamburger menu, which a first-time visitor has no reason to open.
const base: InstallNudgeState = {
  standalone: false,
  dismissed: false,
  inAppBrowser: false,
  valueMoments: MIN_VALUE_MOMENTS,
};

describe("install nudge", () => {
  it("offers the install once the visitor has used the app", () => {
    expect(shouldOfferInstall(base)).toBe(true);
  });

  it("says nothing on arrival", () => {
    // A prompt over an empty map asks for commitment before showing worth.
    expect(shouldOfferInstall({ ...base, valueMoments: 0 })).toBe(false);
  });

  it("never asks someone who already installed it", () => {
    expect(shouldOfferInstall({ ...base, standalone: true })).toBe(false);
    // Even with everything else pointing at yes.
    expect(shouldOfferInstall({ ...base, standalone: true, valueMoments: 99 })).toBe(false);
  });

  it("does not ask twice", () => {
    expect(shouldOfferInstall({ ...base, dismissed: true })).toBe(false);
  });

  it("stays quiet where installing cannot work", () => {
    // KakaoTalk and the other in-app browsers have no install path at all.
    // Offering one there sends the visitor to a dead end.
    expect(shouldOfferInstall({ ...base, inAppBrowser: true })).toBe(false);
  });

  it("asks after one useful action, not after a tour of the app", () => {
    // The threshold is a judgement, so it is pinned rather than left implicit.
    expect(MIN_VALUE_MOMENTS).toBe(1);
  });
});

// The policy above decides nothing on its own. These pin the two wires that
// make it reach a visitor, because either could be dropped in a refactor
// without a single test going red.
describe("install nudge wiring", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", path), "utf8");

  it("counts a save as the value moment", () => {
    const button = read("components/ui/favorite-button.tsx");
    expect(button).toMatch(/import \{ recordValueMoment \} from "@\/lib\/install-nudge"/);
    // Only on save. Un-saving is not a moment worth rewarding with a prompt.
    expect(button).toMatch(/if \(next\) recordValueMoment\(\)/);
  });

  it("renders the offer on the map", () => {
    const screen = read("components/map/map-screen.tsx");
    expect(screen).toMatch(/<InstallNudgeBanner \/>/);
    // Behind the shared-list banner: an offer must never sit on top of a
    // list the visitor just opened from a friend's link.
    expect(screen).toMatch(/!sharedList && <InstallNudgeBanner \/>/);
  });

  it("sends the visitor to the install guide that already handles each platform", () => {
    const banner = read("components/pwa/install-nudge-banner.tsx");
    expect(banner).toMatch(/routes\.download/);
    // The banner must not try to explain iOS and Android itself — the guide
    // at /download does that, including the in-app-browser handoff.
    expect(banner).not.toMatch(/Add to Home Screen/);
  });
});
