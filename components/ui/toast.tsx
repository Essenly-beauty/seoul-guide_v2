"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

type ToastContextValue = {
  toast: (message: string) => void;
  copy: (text: string) => void;
  share: (payload: string | SharePayload) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 1700);
  }, []);

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard?.writeText(text).catch(() => {});
      toast("Copied: " + text);
    },
    [toast],
  );

  const share = useCallback(
    (payload: string | SharePayload) => {
      const data = typeof payload === "string" ? { text: payload } : payload;
      const fallbackText =
        [data.text, data.url].filter(Boolean).join("\n") || data.title || "";

      if (typeof navigator !== "undefined" && navigator.share) {
        navigator.share(data).catch(() => {});
        return;
      }
      navigator.clipboard?.writeText(fallbackText).catch(() => {});
      toast(data.url ? "Link copied" : "Copied: " + fallbackText);
    },
    [toast],
  );

  return (
    <ToastContext.Provider value={{ toast, copy, share }}>
      {children}
      <div className={"toast" + (show ? " show" : "")} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}
