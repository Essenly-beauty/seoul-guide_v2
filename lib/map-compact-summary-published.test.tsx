import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { SelectedPlaceSummary } from "@/components/map/selected-place-summary";
import { mergePublicPlaceProfile } from "@/lib/place-profile";
import type { Place } from "@/lib/data";

const sheet = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url),
  "utf8",
);

// Exactly the `place={...}` expression map-sheet.tsx hands to each summary variant.
function placeExpr(variant: "compact" | "half"): string {
  const end = sheet.indexOf(`variant="${variant}"`);
  const start = sheet.lastIndexOf("<SelectedPlaceSummary", end);
  const m = sheet.slice(start, end).match(/place=\{([^}]*)\}/);
  if (!m) throw new Error(`no place prop for ${variant}`);
  return m[1].trim();
}

const selectedPlace: Place = {
  id: "client-test-salon", name: "Catalog Salon", nameKr: "카탈로그 살롱", type: "hair_salon",
  zone: "gangnam_station", tags: [], address: "Old catalog street 1", lat: 37.5, lng: 127.03,
};
const publishedPlace = mergePublicPlaceProfile(selectedPlace, {
  status: "published", placeId: selectedPlace.id,
  profile: {
    contactPhone: "", contactEmail: "", englishOk: true, notice: "", showPhotos: true,
    nameKo: "호수 성수", nameEn: "HOSU Seongsu", address: "Corrected street 99", introductionKo: "", introductionEn: "",
    updatedAt: "2026-10-20T12:00:00.000Z",
  },
});

function evaluate(expr: string): Place {
  // eslint-disable-next-line no-new-func
  return new Function("publishedPlace", "selectedPlace", `return (${expr});`)(publishedPlace, selectedPlace);
}

function render(variant: "compact" | "half") {
  const place = evaluate(placeExpr(variant));
  const $ = load(renderToStaticMarkup(createElement(SelectedPlaceSummary, { place, km: 0.42, variant })));
  return {
    expr: placeExpr(variant),
    title: $(".selected-place-summary-title .place-name-primary").first().text() || $("h2").first().text(),
    text: $.root().text(),
  };
}

describe("published-2: compact peek card vs half summary", () => {
  it("merge really changes name/address and makes the pin approximate", () => {
    expect(publishedPlace.name).toBe("HOSU Seongsu");
    expect(publishedPlace.address).toBe("Corrected street 99");
    expect(publishedPlace.geoSource).toBe("area");
  });

  it("half summary shows the published place (control)", () => {
    const half = render("half");
    console.log("half expr:", half.expr, "| text:", half.text.slice(0, 160));
    expect(half.text).toContain("HOSU Seongsu");
    expect(half.text).toContain("Corrected street 99");
  });

  it("compact summary shows the same published name, address and approximate status", () => {
    const compact = render("compact");
    console.log("compact expr:", compact.expr, "| text:", compact.text);
    expect(compact.text).toContain("HOSU Seongsu");
    expect(compact.text).toContain("Corrected street 99");
    expect(compact.text).toContain("Approximate pin");
    expect(compact.text).not.toContain("Old catalog street 1");
  });

  it("collapsed handle label names the published place", () => {
    const label = sheet.match(/Selected place preview collapsed\. \$\{([^}]*)\}/)?.[1] ?? "";
    console.log("snapLabel expr:", label);
    expect(label).toContain("publishedPlace");
  });
});
