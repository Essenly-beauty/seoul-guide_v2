import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Why this file is apple-icon1 and not apple-icon: iOS caches a site's
 *  touch icon by URL path and the query hash Next appends did not make a
 *  phone refetch it — the owner re-added the shortcut on 2026-09-27 and
 *  still got the old mark. Next's metadata convention allows one digit
 *  after the name, which moves the route to /apple-icon1 and forces a
 *  fresh fetch. Bump the digit again if the mark ever changes.
 *
 *  The mark at 58% of the canvas, not 87%.
 *
 *  The owner installed the app on a real iPhone (2026-09-27) and the S filled
 *  the icon edge to edge, which read as too large next to every other icon.
 *  Apple's own symbols sit around 60% of the tile, so the mark now does too:
 *  a 104px S inside the 180px tile leaves 38px of ground on each side. It is
 *  the flat brand orange with one very light shadow beneath it, nothing
 *  else. The glossy highlight visible on the Home Screen is iOS 26's own
 *  glass treatment of every icon, not this file.
 *
 *  The mark's path is the one in app/icon.svg; lib/brand-assets.test.ts pins
 *  it here so the two cannot drift. */
const MARK = 104;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f7f9",
        }}
      >
        <svg width={MARK} height={MARK} viewBox="-12 -12 231 232">
          <defs>
            {/* Blur, offset and flood rather than feDropShadow: every raster
                backend in use (resvg here, librsvg for the manifest PNGs)
                supports these three, and feDropShadow is newer than some. */}
            <filter id="s" x="-20%" y="-20%" width="140%" height="150%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
              <feOffset dy="5" result="b" />
              <feFlood floodColor="#1a1208" floodOpacity="0.14" />
              <feComposite in2="b" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            filter="url(#s)"
            d="M203.5 78.3301H147.27C141.585 78.3301 136.273 79.7641 131.755 82.25H176V120.25C176 164.433 136.28 200.25 87.2822 200.25H3V121.25H62.8848C68.8248 121.25 73.9314 119.69 78.0371 117H31.5V79.3223C31.5 35.5139 70.9908 1.75625e-05 119.705 0H203.5V78.3301Z"
            fill="#FF5018"
          />
        </svg>
      </div>
    ),
    size,
  );
}
