"use client";

import { useEffect, useState } from "react";
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

/** Chrome / Firefox / Edge / Opera on iOS. They render with WebKit but Apple
    gives only Safari the Home Screen install, so "open this in Safari" is the
    single honest instruction — and it needs a way to actually get there. */
const IOS_BROWSER_NAMES: [RegExp, string][] = [
  [/CriOS/, "Chrome"],
  [/FxiOS/, "Firefox"],
  [/EdgiOS/, "Edge"],
  [/OPiOS|OPT\//, "Opera"],
];
const iosBrowserName = () =>
  IOS_BROWSER_NAMES.find(([re]) => re.test(navigator.userAgent))?.[1] ?? null;

/**
 * Uses the native browser install prompt where it exists and explains the
 * Safari-only Home Screen path where it does not. It never fakes installation.
 */
export function PwaInstallControl() {
  const [platform, setPlatform] = useState<Platform>("checking");
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // iOS has exactly one install path, so the steps are open by default —
  // collapsing the only instruction behind a toggle read as "there is a
  // download somewhere else" (owner report 2026-08-22).
  const [showIosSteps, setShowIosSteps] = useState(true);
  const [browserName, setBrowserName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  if (platform === "checking") return null;
  if (installed) return <p className="t-caption" style={{ color: "var(--accent)", fontWeight: 700 }}>Installed on this device</p>;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the address bar is still the fallback */
    }
  };

  // iPhone + a non-Safari browser: the old build showed the generic Safari
  // steps with no way to reach Safari, so the visitor was told to go
  // somewhere they could not get to (owner report 2026-08-22).
  if (platform === "ios-other-browser") {
    return (
      <div className="stack xs" style={{ alignItems: "flex-start", textAlign: "left", maxWidth: 340 }}>
        <b className="t-label-md">You’re in {browserName} — iPhone installs only from Safari</b>
        <p className="t-caption muted" style={{ margin: 0 }}>
          Apple lets only Safari add an app to the Home Screen. Copy this link,
          open Safari, paste it, then tap Share → Add to Home Screen.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    );
  }

  if (platform === "in-app") {
    return (
      <div className="stack xs" style={{ alignItems: "flex-start", textAlign: "left", maxWidth: 340 }}>
        <b className="t-label-md">Open in Safari or Chrome to install</b>
        <p className="t-caption muted" style={{ margin: 0 }}>
          KakaoTalk and other in-app browsers cannot install web apps directly. Use the browser menu to open this link externally, then choose Add to Home Screen or Install app.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    );
  }

  if (promptEvent) {
    return (
      <Button variant="primary" size="sm" onClick={() => void install()}>
        Install MYSEOULDROP
      </Button>
    );
  }

  if (platform === "ios") {
    return (
      <div className="stack xs" style={{ alignItems: "flex-start" }}>
        <Button variant="secondary" size="sm" onClick={() => setShowIosSteps((open) => !open)} aria-expanded={showIosSteps}>
          {showIosSteps ? "Hide iPhone install steps" : "Show iPhone install steps"}
        </Button>
        {showIosSteps && (
          <ol className="t-caption muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
            <li>Tap the Share button in Safari’s toolbar.</li>
            <li>Scroll down and choose <b>Add to Home Screen</b>.</li>
            <li>Tap Add. There is nothing to download — the app lands on your Home Screen.</li>
          </ol>
        )}
      </div>
    );
  }

  if (platform === "browser") {
    return <p className="t-caption muted">Use your browser’s Install app menu if the install prompt does not appear.</p>;
  }

  return <p className="t-caption muted">Open this page in Chrome or Safari to install.</p>;
}
