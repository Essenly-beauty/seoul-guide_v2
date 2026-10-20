import { describe, expect, it } from "vitest";
import { translate } from "./i18n/core";
import { contentMessages } from "./i18n/content-messages";

describe("detail and catalogue UI translation", () => {
  it("connects the content catalogue to runtime translation and interpolates values", () => {
    expect(translate("ja", "What should the place be called?")).toBe("正しい店名を教えてください");
    expect(translate("zh-CN", "{minutes} min read", { minutes: 8 })).toBe("阅读约8分钟");
    expect(translate("fr", "No Daiso products match {period} · {category}.", { period: "Du jour", category: "Maquillage" })).toBe("Aucun produit Daiso pour Du jour · Maquillage.");
    expect(translate("en", "{minutes} min", { minutes: 60 })).toBe("60 min");
    expect(translate("fr", "JUNO HAIR | Gangnam Square Branch")).toBe("JUNO HAIR | Gangnam Square Branch");
  });

  it("retains all interpolation variables in every language", () => {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    const keys = Object.keys(contentMessages.ja ?? {});
    for (const locale of ["ja", "zh-CN", "es", "fr"] as const) {
      expect(Object.keys(contentMessages[locale] ?? {})).toEqual(keys);
      for (const [source, translated] of Object.entries(contentMessages[locale] ?? {})) {
        expect(translated.trim(), `${locale}: ${source}`).not.toBe("");
        expect(placeholders(translated), `${locale}: ${source}`).toEqual(placeholders(source));
      }
    }
  });
});
