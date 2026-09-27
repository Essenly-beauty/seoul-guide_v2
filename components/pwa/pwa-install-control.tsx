"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "checking" | "in-app" | "ios-other-browser" | "ios" | "browser" | "unsupported";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isInAppBrowser = () =>
  /KAKAOTALK|NAVER|DaumApps|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);

/** Browsers on iOS use WebKit, but their Home Screen flows differ. Chrome
    exposes Add to Home Screen; other browsers get a Safari handoff. */
const IOS_BROWSER_NAMES: [RegExp, string][] = [
  [/CriOS/, "Chrome"],
  [/FxiOS/, "Firefox"],
  [/EdgiOS/, "Edge"],
  [/OPiOS|OPT\//, "Opera"],
];
const iosBrowserName = () =>
  IOS_BROWSER_NAMES.find(([re]) => re.test(navigator.userAgent))?.[1] ?? null;

// ── Pictures, not prose ──────────────────────────────────────
// The owner's test on a real iPhone (2026-09-27): told to "tap the Share
// button", they could not find it, because the page never showed what it
// looks like or where it sits. So the sheet draws it. These are the iOS
// system glyphs a visitor is actually looking for, drawn large enough to
// recognise at a glance.

/** The iOS Share button: a box with an arrow leaving through the top. */
function ShareGlyph() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" style={{ flex: "none" }}>
      <rect x="5" y="5" width="46" height="46" rx="12" fill="var(--accent-soft)" />
      <path d="M28 33V13m0 0-7 7m7-7 7 7" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 24h-2a3 3 0 0 0-3 3v13a3 3 0 0 0 3 3h24a3 3 0 0 0 3-3V27a3 3 0 0 0-3-3h-2" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** The "Add to Home Screen" row icon: a box with a plus. */
function PlusGlyph() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" style={{ flex: "none" }}>
      <rect x="5" y="5" width="46" height="46" rx="12" fill="var(--accent-soft)" />
      <rect x="15" y="15" width="26" height="26" rx="6" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <path d="M28 21v14M21 28h14" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** The browser's own menu button on Android and desktop: three dots. */
function MenuGlyph() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" style={{ flex: "none" }}>
      <rect x="5" y="5" width="46" height="46" rx="12" fill="var(--accent-soft)" />
      <circle cx="28" cy="17" r="3.4" fill="var(--accent)" />
      <circle cx="28" cy="28" r="3.4" fill="var(--accent)" />
      <circle cx="28" cy="39" r="3.4" fill="var(--accent)" />
    </svg>
  );
}

/** The "tap Add" step has no icon; it is a word on a button. */
function WordGlyph({ word }: { word: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 56, height: 56, borderRadius: 12, flex: "none", display: "grid", placeItems: "center",
        background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 800, fontSize: 15, letterSpacing: 0.2 }}
    >
      {word}
    </span>
  );
}

function StepRow({ n, glyph, title, where }: { n: number; glyph: ReactNode; title: ReactNode; where?: ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 14, alignItems: "center" }}>
      {glyph}
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 16, lineHeight: 1.3 }}>
          <span className="mono" style={{ color: "var(--accent)", marginRight: 8 }}>{n}</span>{title}
        </b>
        {where && <span className="t-caption muted" style={{ display: "block", marginTop: 3, lineHeight: 1.45 }}>{where}</span>}
      </div>
    </li>
  );
}

/** Where the Share button lives differs by browser, and that one fact was
    what the owner could not find. Each variant answers it in its first step. */
type Guide = "safari" | "chrome-ios" | "android" | "in-app";

const GUIDE_KICKER: Record<Guide, string> = {
  safari: "No download · three taps in Safari",
  "chrome-ios": "Add MYSEOULDROP from Chrome",
  android: "No download · from your browser's menu",
  "in-app": "Open in Safari or Chrome to install",
};

function GuideSteps({ guide, copyLink, copied }: { guide: Guide; copyLink: () => void; copied: boolean }) {
  if (guide === "in-app") {
    return (
      <ol className="stack sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <StepRow n={1} glyph={<MenuGlyph />} title="Open this page in Safari or Chrome"
          where="KakaoTalk and other in-app browsers cannot add apps to the Home Screen. Use the ⋮ or ··· menu to open in your browser, or copy the link." />
        <StepRow n={2} glyph={<ShareGlyph />} title="Tap the Share button there" />
        <StepRow n={3} glyph={<PlusGlyph />} title="Choose Add to Home Screen" />
        <li style={{ listStyle: "none" }}>
          <Button variant="secondary" size="sm" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</Button>
        </li>
      </ol>
    );
  }
  if (guide === "android") {
    return (
      <ol className="stack sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <StepRow n={1} glyph={<MenuGlyph />} title="Open the browser menu" where="The ⋮ at the top right of the address bar." />
        <StepRow n={2} glyph={<PlusGlyph />} title="Choose Install app" where="Some browsers call it Add to Home screen." />
        <StepRow n={3} glyph={<WordGlyph word="Install" />} title="Tap Install" where="The app lands on your Home Screen and opens without the browser bars." />
      </ol>
    );
  }
  return (
    <ol className="stack sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      <StepRow
        n={1}
        glyph={<ShareGlyph />}
        title="Tap the Share button"
        where={guide === "safari"
          ? "At the bottom of the screen. If your address bar is at the bottom and you see no Share button, tap ··· at the bottom right first."
          : "At the top right of the address bar. It does not appear in an Incognito tab — use a normal tab."}
      />
      <StepRow n={2} glyph={<PlusGlyph />} title="Choose Add to Home Screen" where="Scroll down the list a little to find it." />
      <StepRow n={3} glyph={<WordGlyph word="Add" />} title="Tap Add" where="Top right. The app lands on your Home Screen and opens without the browser bars." />
    </ol>
  );
}

/**
 * One button. Where a browser can install from the page, the button is the
 * real install prompt. Where it cannot — every browser on iPhone — the button
 * opens a sheet that shows the Share icon as a picture and says where it is.
 * It never fakes an installation.
 */
export function PwaInstallControl() {
  const [platform, setPlatform] = useState<Platform>("checking");
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [browserName, setBrowserName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const otherIosBrowser = isIos() ? iosBrowserName() : null;
    setBrowserName(otherIosBrowser);
    setPlatform(
      isInAppBrowser()
        ? "in-app"
        : otherIosBrowser
          ? "ios-other-browser"
          : isIos()
            ? "ios"
            : "browser",
    );

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the address bar is still the fallback */
    }
  };

  if (platform === "checking") return null;
  if (installed) return <p className="t-caption" style={{ color: "var(--accent)", fontWeight: 700 }}>Installed on this device</p>;

  // The one browser family with no Home Screen path at all gets a handoff,
  // not a guide: Firefox, Edge and Opera on iPhone do not offer Add to Home
  // Screen (iOS has allowed it since 16.4; they have not implemented it).
  if (platform === "ios-other-browser" && browserName !== "Chrome") {
    return (
      <div className="stack xs" style={{ alignItems: "flex-start", textAlign: "left", maxWidth: 340 }}>
        <b className="t-label-md">You’re in {browserName} — open Safari to install</b>
        <p className="t-caption muted" style={{ margin: 0 }}>
          {browserName} on iPhone does not offer Add to Home Screen. Copy this link,
          open Safari or Chrome, paste it, then tap Share → Add to Home Screen.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    );
  }

  // A browser that can install from the page: the button is the install.
  if (promptEvent) {
    return (
      <Button variant="primary" style={{ width: "100%", maxWidth: 340 }} onClick={() => void install()}>
        Install MYSEOULDROP
      </Button>
    );
  }

  if (platform === "unsupported") {
    return <p className="t-caption muted">Open this page in Chrome or Safari to install.</p>;
  }

  const guide: Guide =
    platform === "in-app" ? "in-app"
      : platform === "ios-other-browser" ? "chrome-ios"
        : platform === "ios" ? "safari"
          : "android";

  return (
    <>
      <Button variant="primary" style={{ width: "100%", maxWidth: 340 }} onClick={() => setSheet(true)}>Add to Home Screen</Button>
      {sheet && (
        <BottomSheet
          title="Add to Home Screen"
          kicker={GUIDE_KICKER[guide]}
          onClose={() => setSheet(false)}
          footer={
            <p className="t-caption muted" style={{ margin: 0, lineHeight: 1.5 }}>
              If you’re signed in, your saved places and account follow you into the app.
              Hearts saved without an account stay in the browser you tapped them in.
            </p>
          }
        >
          <GuideSteps guide={guide} copyLink={() => void copyLink()} copied={copied} />
        </BottomSheet>
      )}
    </>
  );
}
