"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { customerLocale, DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, persistLocale, readSavedLocale, translate, type Locale, type MessageValues, type Translate } from "./core";

export * from "./types";
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: Translate };
const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (source, values) => translate(DEFAULT_LOCALE, source, values),
});

function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function browserCookie(): string {
  try { return document.cookie; } catch { return ""; }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  // Both SSR and the initial hydration render are English. Stored selection is
  // applied after mount, avoiding server/client text mismatches on static pages.
  const [selectedLocale, setSelectedLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    const read = () => setSelectedLocale(readSavedLocale(browserStorage(), browserCookie()));
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY || event.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const locale = customerLocale(selectedLocale, pathname);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setSelectedLocale(next);
    persistLocale(next, browserStorage(), (cookie) => { document.cookie = cookie; }, window.location.protocol === "https:");
  }, []);
  const value = useMemo<LocaleContextValue>(() => ({
    locale, setLocale, t: (source, values) => translate(locale, source, values),
  }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue { return useContext(LocaleContext); }

/** A client leaf lets server-rendered pages participate without becoming client pages. */
export function T({ text, values }: { text: string; values?: MessageValues }) {
  const { t } = useLocale();
  return <>{t(text, values)}</>;
}
