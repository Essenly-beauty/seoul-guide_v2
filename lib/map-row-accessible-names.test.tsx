import { renderToStaticMarkup } from "react-dom/server";
import { load, type CheerioAPI } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { MapSheet } from "@/components/map/map-sheet";
import { PLACES, type Place } from "@/lib/data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back() {}, push() {} }), usePathname: () => "/map" }));
vi.mock("@/lib/auth/use-auth", () => ({ useAuthUser: () => ({ user: null, loading: false }) }));

// Simplified accessible-name-from-content (enough for these rows): aria-hidden
// subtrees are skipped, <img> contributes its alt, an element with aria-label
// contributes the label, text nodes contribute their text.
function nameFromContent($: CheerioAPI, el: Parameters<CheerioAPI>[0]): string {
  const parts: string[] = [];
  const walk = (node: any) => {
    if (node.type === "text") { parts.push(node.data); return; }
    if (node.type !== "tag") return;
    const attrs = node.attribs ?? {};
    if (attrs["aria-hidden"] === "true") return;
    if (node.name === "img") { parts.push(attrs.alt ?? ""); return; }
    if (attrs["aria-label"]) { parts.push(attrs["aria-label"]); return; }
    for (const child of node.children ?? []) walk(child);
  };
  for (const child of ($(el as any)[0] as any).children ?? []) walk(child);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

const origin = { lat: 37.5, lng: 127.03 };
const salon: Place = { id: "a11y-salon", name: "Test Salon", nameKr: "테스트 살롱", type: "hair_salon", zone: "gangnam_station", tags: [], address: "Test street", lat: 37.5, lng: 127.03, geoSource: "address" };
const withPhoto = PLACES.find((p) => p.photoThumbnail && p.type !== "olive_young")!;
const oyNoPhoto = PLACES.find((p) => p.type === "olive_young" && !p.photos?.length && !p.photoThumbnail)!;

describe("map sheet nearby rows: accessible names", () => {
  it.each([
    ["photo-less salon", salon],
    ["place with a photo", withPhoto],
    ["Olive Young without a photo", oyNoPhoto],
  ])("the row button for a %s is named by its visible copy, the thumbnail adds nothing", (_label, place) => {
    const $ = load(renderToStaticMarkup(<MapSheet places={[place]} origin={origin} selectedId={null} onSelect={() => {}} onClearSelection={() => {}} />));
    const row = $("button.maprow").first();
    expect(row.length).toBe(1);
    const name = nameFromContent($, row[0]);
    const copy = nameFromContent($, row.find(".maprow-copy")[0]);
    console.log(JSON.stringify({ name, copy }));
    // HEAD rendered the row media with alt="" (pinned by the old wiring test), so
    // the row was named by its visible copy alone.
    expect(name).toBe(copy);
  });
});
