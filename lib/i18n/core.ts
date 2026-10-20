import { bookingMessages } from "./booking-messages";
import { baseMessages } from "./messages";
import { customerMessages } from "./customer-messages";
import { contentMessages } from "./content-messages";
import { LOCALES, type Locale, type MessageValues } from "./types";

export * from "./types";
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "myseouldrop.locale";
export const LOCALE_COOKIE = "myseouldrop_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeFromCookie(cookie: string): Locale | null {
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${LOCALE_COOKIE}=`))?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : null;
}

type LocaleStorage = Pick<Storage, "getItem" | "setItem">;
export function readSavedLocale(storage: LocaleStorage | null, cookie = ""): Locale {
  // Either persistence API can be unavailable in private or embedded browsers.
  try {
    const stored = storage?.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch { /* Try the first-party cookie next. */ }
  return localeFromCookie(cookie) ?? DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale, storage: LocaleStorage | null, writeCookie: (cookie: string) => void, secure = false): void {
  if (!isLocale(locale)) return;
  try { storage?.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Cookie remains a fallback. */ }
  try {
    writeCookie(`${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`);
  } catch { /* Selection still works in this session. */ }
}

export function translate(locale: Locale, source: string, values?: MessageValues): string {
  const lookup = (messages: Record<string, string> | undefined) => messages && Object.prototype.hasOwnProperty.call(messages, source) ? messages[source] : undefined;
  const message = locale === "en" ? source : lookup(bookingMessages[locale]) ?? lookup(customerMessages[locale]) ?? lookup(contentMessages[locale]) ?? lookup(baseMessages[locale]) ?? source;
  return message.replace(/\{([\w]+)\}/g, (placeholder, key: string) =>
    values && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder);
}

export function customerLocale(locale: Locale, pathname: string): Locale {
  return pathname === "/partner" || pathname.startsWith("/partner/") ? DEFAULT_LOCALE : locale;
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(locale: Locale, value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}
