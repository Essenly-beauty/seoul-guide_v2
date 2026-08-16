"use client";

// App theme (LIGHT default / dark optional — user decision 2026-08-15).
// The <html data-theme> attribute is the single source of truth: an inline
// head script sets it pre-paint (no flash), this context mirrors it for
// React consumers (map tiles, settings).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type AppTheme = "dark" | "light";
export const THEME_KEY = "essenly.theme";

const ThemeContext = createContext<{ theme: AppTheme; setTheme: (t: AppTheme) => void }>({
  theme: "light",
  setTheme: () => {},
});

/** Keep the browser chrome (status bar / address bar) on the app's theme —
    the static viewport meta was dark-only, wrong in light mode (audit). */
function applyMetaTheme(theme: AppTheme) {
  const color = theme === "light" ? "#f6f7f9" : "#0b0c0f";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    // boot script stamps the attribute pre-paint; if anything ever strips it
    // mid-session, self-heal from storage and DEFAULT TO LIGHT — a missing
    // attribute must never flip tiles/controls dark (mixed-theme bug,
    // user report 2026-08-16)
    let current = document.documentElement.getAttribute("data-theme");
    if (current !== "light" && current !== "dark") {
      let stored: AppTheme = "light";
      try {
        stored = window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
      } catch { /* default light */ }
      document.documentElement.setAttribute("data-theme", stored);
      current = stored;
    }
    if (current === "dark") setThemeState("dark");
    applyMetaTheme(current === "dark" ? "dark" : "light");
    // last line of defense: if ANYTHING strips the attribute mid-session,
    // restore it immediately from storage (the mixed-theme bug's true fix is
    // the :not([data-theme="dark"]) CSS, this keeps context/tiles honest too)
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const now = el.getAttribute("data-theme");
      if (now === "light" || now === "dark") return;
      let stored: AppTheme = "light";
      try {
        stored = window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
      } catch { /* default light */ }
      el.setAttribute("data-theme", stored);
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    applyMetaTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch { /* ignore */ }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
