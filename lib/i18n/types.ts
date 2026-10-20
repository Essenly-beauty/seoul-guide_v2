export const LOCALES = ["en", "ja", "zh-CN", "es", "fr"] as const;
export type Locale = typeof LOCALES[number];
export type MessageValues = Record<string, string | number>;
export type MessageCatalog = Partial<Record<Exclude<Locale, "en">, Record<string, string>>>;
export type Translate = (source: string, values?: MessageValues) => string;

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English", ja: "日本語", "zh-CN": "简体中文", es: "Español", fr: "Français",
};
