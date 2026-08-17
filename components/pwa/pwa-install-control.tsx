"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "checking" | "ios" | "browser" | "unsupported";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Uses the native browser install prompt where it exists and explains the
 * Safari-only Home Screen path where it does not. It never fakes installation.
 */
export function PwaInstallControl() {
  const [platform, setPlatform] = useState<Platform>("checking");
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setPlatform(isIos() ? "ios" : "browser");

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
          Add to Home Screen
        </Button>
        {showIosSteps && (
          <ol className="t-caption muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
            <li>Open this page in Safari.</li>
            <li>Tap Share, then choose Add to Home Screen.</li>
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
