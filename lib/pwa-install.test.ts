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
    expect(control).toContain("KAKAOTALK|NAVER");
    expect(control).toContain("Open in Safari or Chrome to install");
    expect(control).toContain("Add MYSEOULDROP from Chrome");
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

describe("iOS browser dead ends", () => {
  const control = readFileSync(new URL("../components/pwa/pwa-install-control.tsx", import.meta.url), "utf8");

  it("names the non-Safari iOS browser instead of pointing at Safari with no way there", () => {
    // owner hit this in Chrome for iOS: told to "open in Safari", no route to Safari
    expect(control).toContain("CriOS");
    expect(control).toContain("FxiOS");
    expect(control).toContain("EdgiOS");
    expect(control).toContain("ios-other-browser");
    expect(control).toContain("open Safari to install");
  });

  it("always offers a copy-link escape from a browser that cannot install", () => {
    const copyCount = control.split("Copy link").length - 1;
    expect(copyCount).toBeGreaterThanOrEqual(2); // in-app browsers AND iOS other browsers
  });

  it("has no toggle in front of the only iOS instruction", () => {
    // The 2026-08-22 fix opened the steps by default but kept the button.
    // On 2026-09-27 the owner, testing on a real iPhone, tapped that button
    // expecting it to install, watched the steps fold away, and reported the
    // button as broken. A button under an "Install" heading reads as the
    // install. So there is no button: the steps are always visible.
    expect(control).not.toContain("install steps");
    expect(control).not.toContain("setShowIosSteps");
  });

  it("leads with one button, not a paragraph", () => {
    // Owner, testing on a real iPhone (2026-09-27): "users press a button
    // that looks like Install; they do not read instructions." iOS cannot
    // install from a page, so the button opens a guided sheet that points at
    // the Share icon with a picture. Android's button is the real prompt.
    expect(control).toContain("<BottomSheet");
    expect(control).toContain('title="Add to Home Screen"');
    expect(control).toContain("Add to Home Screen</Button>");
  });

  it("shows the Share icon as a picture and says where it is, per browser", () => {
    // "Tap the Share button" sent the owner looking for one that was not in
    // the toolbar. The sheet draws the icon and names its place: Safari at
    // the bottom (or behind ··· when the address bar is at the bottom),
    // Chrome at the top right of the address bar.
    expect(control).toContain("ShareGlyph");
    expect(control).toContain("··· at the bottom right");
    expect(control).toContain("top right of the address bar");
  });

  it("warns that Chrome cannot add to the Home Screen from an Incognito tab", () => {
    // The owner's first attempt was in an Incognito tab, where the option
    // never appears. Nothing on the page said so.
    expect(control).toContain("Incognito");
  });

  it("does not claim Apple forbids what iOS 16.4 allows", () => {
    // Third-party browsers can add to the Home Screen since iOS 16.4; some
    // just have not implemented it. Blaming Apple was wrong and unhelpful.
    expect(control).not.toContain("Apple lets only Safari");
  });

  it("says plainly that nothing downloads", () => {
    const page = readFileSync(new URL("../app/download/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("There is no file to download");
  });

  it("does not promise a guest that their hearts follow them into the installed app", () => {
    // A Home Screen web app has its own storage. Hearts saved without an
    // account live in the browser's localStorage and do not carry over;
    // only account-backed saves do. The old page lead promised both would.
    const page = readFileSync(new URL("../app/download/page.tsx", import.meta.url), "utf8");
    expect(page).not.toContain("stay exactly where they are");
    expect(control).toContain("signed in");
  });

  it("keeps the page to the button — the explanation lives in the sheet", () => {
    // The two paragraphs under the button repeated the sheet in prose. The
    // owner's report: nobody reads them, and they make the page look like
    // the button is somewhere else.
    const page = readFileSync(new URL("../app/download/page.tsx", import.meta.url), "utf8");
    expect(page).not.toContain("iPhone does not show an in-page download prompt");
    expect(page).not.toContain("Android &amp; desktop");
  });
});
