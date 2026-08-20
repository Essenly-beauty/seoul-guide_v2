import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Native PNG Apple touch icon generated from the supplied Seoul mark. */
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
        <svg width="156" height="157" viewBox="0 0 207 208">
          <path d="M203.5 78.3301H147.27C141.585 78.3301 136.273 79.7641 131.755 82.25H176V120.25C176 164.433 136.28 200.25 87.2822 200.25H3V121.25H62.8848C68.8248 121.25 73.9314 119.69 78.0371 117H31.5V79.3223C31.5 35.5139 70.9908 1.75625e-05 119.705 0H203.5V78.3301Z" fill="#FF5018" />
        </svg>
      </div>
    ),
    size,
  );
}
