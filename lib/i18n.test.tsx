import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { customerLocale, LANGUAGE_NAMES, LOCALES, LOCALE_STORAGE_KEY, LOCALE_COOKIE, localeFromCookie, persistLocale, readSavedLocale, resolveLocale, translate } from "./i18n/core";
import { baseMessages } from "./i18n/messages";
import { LocaleProvider, T } from "./i18n/locale-provider";
import LanguagePage from "@/app/settings/language/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/language",
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("customer locale resolution and persistence", () => {
  it("starts in English and accepts only the five supported explicit choices", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("ko")).toBe("en");
    expect(resolveLocale("ja-JP")).toBe("en");
    for (const locale of LOCALES) expect(resolveLocale(locale)).toBe(locale);
  });

  it.each(LOCALES)("restores %s after selecting it, including via cookie when storage is blocked", (locale) => {
    const storage = memoryStorage();
    let cookie = "";
    persistLocale(locale, storage, (next) => { cookie = next; }, true);
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe(locale);
    expect(readSavedLocale(storage)).toBe(locale);
    expect(localeFromCookie(`theme=dark; ${cookie}`)).toBe(locale);
    expect(readSavedLocale(null, cookie)).toBe(locale);
    expect(cookie).toContain("SameSite=Lax; Secure");
  });

  it("keeps the selected language usable when either persistence API throws", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const writeCookie = vi.fn();
    persistLocale("ja", storage, writeCookie);
    expect(writeCookie).toHaveBeenCalledWith(expect.stringContaining(`${LOCALE_COOKIE}=ja`));
    expect(readSavedLocale(storage, `${LOCALE_COOKIE}=fr`)).toBe("fr");
    expect(() => persistLocale("es", storage, () => { throw new Error("blocked"); })).not.toThrow();
    expect(readSavedLocale(storage, `${LOCALE_COOKIE}=invalid`)).toBe("en");
  });

  it("prefers a valid saved choice, rejects malformed cookies, and excludes partner screens", () => {
    const storage = memoryStorage();
    storage.setItem(LOCALE_STORAGE_KEY, "es");
    expect(readSavedLocale(storage, `${LOCALE_COOKIE}=ja`)).toBe("es");
    expect(localeFromCookie(`${LOCALE_COOKIE}=%ZZ`)).toBeNull();
    expect(customerLocale("ja", "/partner")).toBe("en");
    expect(customerLocale("fr", "/partner/staff")).toBe("en");
    expect(customerLocale("zh-CN", "/map")).toBe("zh-CN");
  });
});

describe("source messages", () => {
  it("translates a label and preserves unknown English source text", () => {
    expect(translate("ja", "Language")).toBe("言語");
    expect(translate("zh-CN", "Password")).toBe("密码");
    expect(translate("es", "A new label")).toBe("A new label");
    expect(translate("fr", "constructor")).toBe("constructor");
  });

  it("interpolates translated and fallback messages without treating values as markup", () => {
    expect(translate("fr", "Resend available in {seconds}s", { seconds: 0 })).toBe("Renvoi possible dans 0 s");
    expect(translate("ja", "Hello {name}", { name: "<b>Ada</b>" })).toBe("Hello <b>Ada</b>");
    expect(translate("en", "Hello {name}")).toBe("Hello {name}");
    expect(translate("en", "Hello {name}", Object.create({ name: "inherited" }))).toBe("Hello {name}");
  });

  it("includes a nonempty translation for every shared source key in every language", () => {
    const keys = Object.keys(baseMessages.ja ?? {});
    expect(keys.length).toBeGreaterThan(100);
    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      expect(Object.keys(baseMessages[locale] ?? {})).toEqual(keys);
      for (const value of Object.values(baseMessages[locale] ?? {})) expect(value.trim()).not.toBe("");
    }
  });

  it("renders an English hydration baseline with safely escaped source values", () => {
    const html = renderToStaticMarkup(createElement(LocaleProvider, null, createElement(T, { text: "Hello {name}", values: { name: "<script>" } })));
    expect(html).toBe("Hello &lt;script&gt;");
  });

  it("renders all five native language names as a keyboard-operable radio group", () => {
    const html = renderToStaticMarkup(createElement(LanguagePage));
    for (const name of Object.values(LANGUAGE_NAMES)) expect(html).toContain(name);
    expect(html.match(/type="radio"/g)).toHaveLength(5);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('<fieldset');
    expect(html).toContain('role="status"');
  });
});
