// Social share card — dark brand canvas, supplied Seoul mark, two-tone wordmark.
// Michroma is fetched from Google Fonts at render time (Satori needs raw
// TTF bytes); if that fetch ever fails we fall back to a text-free card
// rather than erroring the crawler.

import { ImageResponse } from "next/og";

export const alt = "MYSEOULDROP — Seoul beauty, mapped.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ORANGE = "#F55800";

async function loadMichroma(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch("https://fonts.googleapis.com/css2?family=Michroma");
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const fontRes = await fetch(url);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

function Mark({ px }: { px: number }) {
  return (
    <svg viewBox="0 0 207 208" width={px} height={px}>
      <path d="M203.5 78.3301H147.27C141.585 78.3301 136.273 79.7641 131.755 82.25H176V120.25C176 164.433 136.28 200.25 87.2822 200.25H3V121.25H62.8848C68.8248 121.25 73.9314 119.69 78.0371 117H31.5V79.3223C31.5 35.5139 70.9908 1.75625e-05 119.705 0H203.5V78.3301Z" fill={ORANGE} />
    </svg>
  );
}

export default async function Image() {
  const michroma = await loadMichroma();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 88,
          background: "#0b0c0f",
          position: "relative",
        }}
      >
        {/* oversized ghost mark bleeding off the right edge */}
        <div style={{ display: "flex", position: "absolute", right: -140, top: 90, opacity: 0.09 }}>
          <Mark px={560} />
        </div>
        <div style={{ display: "flex" }}>
          <Mark px={110} />
        </div>
        {michroma ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            <div style={{ display: "flex", fontFamily: "Michroma", fontSize: 72, letterSpacing: 3, color: "#f4f5f7" }}>
              <span>MY</span>
              <span style={{ color: ORANGE }}>SEOUL</span>
              <span>DROP</span>
              <span style={{ color: ORANGE }}>.</span>
            </div>
            <div style={{ display: "flex", marginTop: 30, fontFamily: "Michroma", fontSize: 30, letterSpacing: 1, color: "#9aa0a8" }}>
              Seoul beauty, mapped.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: 48, gap: 18 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: 13, background: ORANGE, opacity: 1 - i * 0.3 }} />
            ))}
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: michroma ? [{ name: "Michroma", data: michroma, style: "normal" as const, weight: 400 as const }] : [],
    },
  );
}
