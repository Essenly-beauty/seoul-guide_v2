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
        <svg width="156" height="157" viewBox="0 0 207 209">
          <path d="M203.5 78.3301H147.27C140.861 78.3301 134.925 80.1518 130.067 83.25H176V121.25C176 165.433 136.28 201.25 87.2822 201.25H3V122.25H62.8848C69.5256 122.25 75.1239 120.299 79.4473 117H31.5V79.3223C31.5 35.5139 70.9908 1.75625e-05 119.705 0H203.5V78.3301Z" fill="#FF5018" />
        </svg>
      </div>
    ),
    size,
  );
}
