// Fonts for next/og share cards. Satori needs raw TTF/OTF bytes; the Google
// Fonts CSS API hands a UA-less fetch TTF sources, and `text=` subsets the
// file to exactly the glyphs on the card — so a Korean place name costs a few
// KB instead of a multi-megabyte CJK font. Failures return null and the card
// degrades (never errors the crawler).

export function googleFontCssUrl(family: string, text?: string): string {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}`;
  return text ? `${url}&text=${encodeURIComponent(text)}` : url;
}

export function parseGoogleFontFileUrl(css: string): string | null {
  return css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1] ?? null;
}

export async function loadGoogleFont(family: string, text?: string): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(googleFontCssUrl(family, text));
    if (!cssRes.ok) return null;
    const url = parseGoogleFontFileUrl(await cssRes.text());
    if (!url) return null;
    const fontRes = await fetch(url);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
