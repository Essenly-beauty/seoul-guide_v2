import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("installable PWA contract", () => {
  it("ships a standalone map-first manifest with Android-safe PNG icons", () => {
    const manifest = source("public/manifest.json");
    expect(manifest).toContain('"start_url": "/map"');
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"src": "/icon-192.png"');
    expect(manifest).toContain('"src": "/icon-512.png"');
  });

  it("uses an offline-only worker rather than caching map or account traffic", () => {
    const worker = source("public/sw.js");
    expect(worker).toContain('"/offline.html"');
    expect(worker).toContain('event.request.mode !== "navigate"');
    expect(worker).not.toContain("caches.put(request");
  });

  it("registers the worker once and exposes a real browser install action", () => {
    expect(source("components/system/pwa-register.tsx")).toContain('navigator.serviceWorker.register("/sw.js")');
    const control = source("components/pwa/pwa-install-control.tsx");
    expect(control).toContain('window.addEventListener("beforeinstallprompt"');
    expect(control).toContain("Add to Home Screen");
    expect(source("app/layout.tsx")).toContain("<PwaRegister />");
  });

  it("offers the same install destination from the app and a shareable download page", () => {
    expect(source("app/settings/page.tsx")).toContain("href={routes.settingsApp}");
    expect(source("app/settings/app/page.tsx")).toContain("<PwaInstallControl />");
    expect(source("components/ui/hamburger-menu.tsx")).toContain("href: routes.download");
    const download = source("app/download/page.tsx");
    expect(download).toContain("Install MYSEOULDROP");
    expect(download).toContain("App Store");
    expect(download).toContain("Google Play");
  });
});
