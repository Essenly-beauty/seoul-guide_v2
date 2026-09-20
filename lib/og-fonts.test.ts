import { describe, expect, it } from "vitest";
import { googleFontCssUrl, parseGoogleFontFileUrl } from "./og-fonts";

/** Satori (next/og ImageResponse) needs raw TTF bytes; Google Fonts' CSS API
 *  returns TTF sources to a UA-less fetch, and `text=` subsets the file to the
 *  exact glyphs — the only practical way to render a Korean place name in a
 *  share card without shipping a multi-megabyte CJK font. */
describe("og fonts", () => {
  it("builds a subset CSS URL when text is given", () => {
    expect(googleFontCssUrl("Noto Sans KR", "올리브영 명동"))
      .toBe("https://fonts.googleapis.com/css2?family=Noto+Sans+KR&text=%EC%98%AC%EB%A6%AC%EB%B8%8C%EC%98%81%20%EB%AA%85%EB%8F%99");
    expect(googleFontCssUrl("Michroma")).toBe("https://fonts.googleapis.com/css2?family=Michroma");
  });

  it("extracts the first TTF/OTF source URL from the CSS", () => {
    const css = `/* latin */\n@font-face {\n  font-family: 'Michroma';\n  src: url(https://fonts.gstatic.com/s/michroma/v19/PN_zRfy9qWD8fEagAMg6rzjb.ttf) format('truetype');\n}`;
    expect(parseGoogleFontFileUrl(css)).toBe("https://fonts.gstatic.com/s/michroma/v19/PN_zRfy9qWD8fEagAMg6rzjb.ttf");
  });

  it("returns null when no TTF/OTF source is present (woff2-only response)", () => {
    expect(parseGoogleFontFileUrl("@font-face { src: url(https://x/y.woff2) format('woff2'); }")).toBeNull();
  });
});
