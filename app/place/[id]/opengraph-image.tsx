// Per-place share card (KakaoTalk / LINE / iMessage previews). Same dark
// brand canvas as the root card, plus the English name, the Korean name
// (subset Noto Sans KR fetched for exactly these glyphs) and the area chip.
// Any font that fails to load simply drops its line — never a crawler error.

import { ImageResponse } from "next/og";
import { getPlace, TYPE_LABEL, ZONE_LABEL } from "@/lib/data";
import { loadGoogleFont } from "@/lib/og-fonts";

export const alt = "Place on MYSEOULDROP — Seoul beauty, mapped.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Cards are cached for a day: six font fetches per render would otherwise
// hit Google Fonts on every crawler visit.
export const revalidate = 86400;

const ORANGE = "#F55800";

function Mark({ px }: { px: number }) {
  return (
    <svg viewBox="0 0 207 208" width={px} height={px}>
      <path d="M203.5 78.3301H147.27C141.585 78.3301 136.273 79.7641 131.755 82.25H176V120.25C176 164.433 136.28 200.25 87.2822 200.25H3V121.25H62.8848C68.8248 121.25 73.9314 119.69 78.0371 117H31.5V79.3223C31.5 35.5139 70.9908 1.75625e-05 119.705 0H203.5V78.3301Z" fill={ORANGE} />
    </svg>
  );
}

type Font = { name: string; data: ArrayBuffer; style: "normal"; weight: 400 | 700 };

export default async function Image(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const place = getPlace(id);
  const name = place?.name ?? "MYSEOULDROP";
  const nameKr = place && place.nameKr && place.nameKr.trim().toLowerCase() !== place.name.trim().toLowerCase() ? place.nameKr : null;
  const chip = place ? `${TYPE_LABEL[place.type]} · ${ZONE_LABEL[place.zone]}` : "Seoul beauty, mapped.";
  const address = place?.address ?? "";

  const [michroma, sans, kr] = await Promise.all([
    loadGoogleFont("Michroma", "MYSEOULDROP."),
    loadGoogleFont("Plus Jakarta Sans:wght@700", `${name} ${chip}`),
    nameKr || address ? loadGoogleFont("Noto Sans KR", `${nameKr ?? ""} ${address}`) : Promise.resolve(null),
  ]);
  const fonts: Font[] = [];
  if (michroma) fonts.push({ name: "Michroma", data: michroma, style: "normal", weight: 400 });
  if (sans) fonts.push({ name: "Jakarta", data: sans, style: "normal", weight: 700 });
  if (kr) fonts.push({ name: "NotoKR", data: kr, style: "normal", weight: 400 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0b0c0f",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", position: "absolute", right: -140, top: 90, opacity: 0.09 }}>
          <Mark px={560} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark px={48} />
          {michroma && (
            <div style={{ display: "flex", fontFamily: "Michroma", fontSize: 26, letterSpacing: 2, color: "#f4f5f7" }}>
              <span>MY</span><span style={{ color: ORANGE }}>SEOUL</span><span>DROP</span><span style={{ color: ORANGE }}>.</span>
            </div>
          )}
        </div>
        {sans ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontFamily: "Jakarta", fontSize: 24, letterSpacing: 3, color: ORANGE, textTransform: "uppercase" }}>
              {chip}
            </div>
            <div style={{ display: "flex", fontFamily: "Jakarta", fontSize: name.length > 28 ? 52 : 64, lineHeight: 1.1, color: "#f4f5f7", maxWidth: 1000 }}>
              {name.length > 60 ? `${name.slice(0, 57)}…` : name}
            </div>
            {kr && nameKr && (
              <div lang="ko" style={{ display: "flex", fontFamily: "NotoKR", fontSize: 36, color: "#c6cad1" }}>
                {nameKr}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 18 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: 13, background: ORANGE, opacity: 1 - i * 0.3 }} />
            ))}
          </div>
        )}
        {kr && address ? (
          <div lang="ko" style={{ display: "flex", fontFamily: "NotoKR", fontSize: 24, color: "#9aa0a8" }}>
            {address}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
