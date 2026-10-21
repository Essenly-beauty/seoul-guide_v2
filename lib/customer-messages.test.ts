import { describe, expect, it } from "vitest";
import { customerMessages } from "./i18n/customer-messages";
import { translate } from "./i18n/core";

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe("customer navigation translations", () => {
  it("provides all four translations without losing dynamic counts or names", () => {
    const sources = Object.keys(customerMessages.ja!);
    for (const locale of ["ja", "zh-CN", "es", "fr"] as const) {
      expect(Object.keys(customerMessages[locale]!)).toEqual(sources);
      for (const source of sources) {
        const message = customerMessages[locale]![source];
        expect(message.trim(), `${locale}: ${source}`).not.toBe("");
        expect(placeholders(message), `${locale}: ${source}`).toEqual(placeholders(source));
      }
    }
  });

  it("translates core discovery and booking notices while retaining proper names", () => {
    for (const locale of ["ja", "zh-CN", "es", "fr"] as const) {
      expect(translate(locale, "Search places, areas")).not.toBe("Search places, areas");
      expect(translate(locale, "Booking on MYSEOULDROP is not available for this venue yet.")).not.toContain("not available");
      expect(translate(locale, "Near {station}", { station: "Gangnam" })).toContain("Gangnam");
      expect(translate(locale, "JUNO HAIR | Gangnam Square Branch")).toBe("JUNO HAIR | Gangnam Square Branch");
    }
  });
});
