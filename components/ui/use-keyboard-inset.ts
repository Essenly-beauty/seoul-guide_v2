"use client";

import { useEffect } from "react";
import { keyboardInset } from "@/lib/keyboard-inset";

/**
 * Publishes the software keyboard's height as `--kb` on <html> so layout can
 * shrink around it. CSS that needs it reads `var(--kb, 0px)`.
 *
 * Writes are merged into one animation frame: iOS fires resize and scroll
 * together many times while the keyboard animates, and writing a custom
 * property on the root invalidates style for the whole document.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let frame = 0;
    let last = -1;

    const write = () => {
      frame = 0;
      const next = keyboardInset({
        innerHeight: window.innerHeight,
        viewportHeight: vv.height,
        offsetTop: vv.offsetTop,
        scale: vv.scale,
      });
      if (next === last) return;
      last = next;
      if (next === 0) root.style.removeProperty("--kb");
      else root.style.setProperty("--kb", `${next}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(write);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    // iOS does not always return offsetTop to 0 when the field blurs.
    window.addEventListener("focusout", schedule);
    window.addEventListener("orientationchange", schedule);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("focusout", schedule);
      window.removeEventListener("orientationchange", schedule);
      root.style.removeProperty("--kb");
    };
  }, []);
}
