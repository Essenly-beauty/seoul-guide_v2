"use client";

import { useEffect } from "react";

/** Registers the intentionally offline-only worker after the app has loaded. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is progressive enhancement. A failed registration
        // must never prevent maps, auth, or the normal web experience.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
