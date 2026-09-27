"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { shouldOfferInstall, type InstallNudgeState } from "./install-nudge-policy";

const MOMENTS_KEY = "essenly.install.moments";
const DISMISSED_KEY = "essenly.install.dismissed";

/** Every accessor is wrapped: a private window, blocked site data, or a
 *  preview surface can make localStorage throw rather than return null, and a
 *  failed nudge must never take a screen down with it. */
function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* the nudge is optional */ }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const isStandaloneDisplay = (): boolean => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  } catch { return false; }
};

/** KakaoTalk, Naver, Instagram and the rest render in a webview with no
 *  install path. The same list the install guide uses. */
export const isInAppBrowser = (): boolean => {
  try { return /KAKAOTALK|NAVER|DaumApps|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent); }
  catch { return false; }
};

/** Call when the visitor gets something out of the app — saves a place, opens
 *  directions. The count is what the policy reads. */
export function recordValueMoment(): void {
  const next = String(readMoments() + 1);
  write(MOMENTS_KEY, next);
  emit();
}

export function dismissInstallNudge(): void {
  write(DISMISSED_KEY, "1");
  emit();
}

const readMoments = (): number => {
  const n = Number(read(MOMENTS_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function snapshot(): string {
  return `${readMoments()}|${read(DISMISSED_KEY) ?? ""}`;
}

/** Whether to show the Home Screen offer right now. Server-render and the
 *  first client paint both return false, so the bar never flashes in before
 *  the browser has been asked what it is. */
export function useInstallOffer(): { offered: boolean; dismiss: () => void } {
  const key = useSyncExternalStore(subscribe, snapshot, () => "0|");
  const [moments, dismissed] = key.split("|");
  const dismiss = useCallback(() => dismissInstallNudge(), []);

  // matchMedia and userAgent are only meaningful on the client, and the
  // display mode can change while the app is open (a visitor installs it in
  // another tab), so this re-checks rather than reading once.
  const state: InstallNudgeState = {
    standalone: typeof window === "undefined" ? true : isStandaloneDisplay(),
    dismissed: dismissed === "1",
    inAppBrowser: typeof window === "undefined" ? true : isInAppBrowser(),
    valueMoments: Number(moments) || 0,
  };

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const onChange = () => emit();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return { offered: shouldOfferInstall(state), dismiss };
}
