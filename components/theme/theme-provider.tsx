"use client";

// App theme (dark default / light optional). The <html data-theme> attribute
// is the single source of truth: an inline head script sets it pre-paint (no
// flash), this context mirrors it for React consumers (map tiles, settings).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type AppTheme = "dark" | "light";
export const THEME_KEY = "essenly.theme";

const ThemeContext = createContext<{ theme: AppTheme; setTheme: (t: AppTheme) => void }>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light") setThemeState("light");
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch { /* ignore */ }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
