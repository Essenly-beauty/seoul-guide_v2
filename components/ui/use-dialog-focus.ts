"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
  /** Where focus returns when the element that opened the dialog is gone by
      the time it closes (its section was switched off or re-rendered). */
  returnFocusFallbackRef?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const fallbackAtClose = () => returnFocusFallbackRef?.current ?? null;
    const getFocusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
        // A listbox's arrow-key options are buttons too, but tabindex=-1
        // excludes them from the native Tab order. They cannot define its edge.
        // :disabled also covers inputs disabled by an ancestor fieldset.
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert], [aria-hidden="true"]'));

    const focusFrame = requestAnimationFrame(() => {
      (initialFocusRef?.current ?? getFocusable()[0] ?? dialog)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => {
        // Read at close time on purpose: the fallback is whatever node holds the ref then.
        const target = previouslyFocused?.isConnected === false ? fallbackAtClose() : previouslyFocused;
        target?.focus();
      });
    };
  }, [initialFocusRef, open, returnFocusFallbackRef]);

  return dialogRef;
}
