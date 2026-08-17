// Security headers (launch checklist B10). The CSP is enforced, not
// report-only: the app's external surface is exactly four hosts (Google
// Fonts css/files, Carto map tiles, Supabase) — everything else is
// locked down. script/style keep 'unsafe-inline' (Next.js reality
// without a nonce pipeline); dev additionally needs eval for refresh.
// error-reporter.ts listens for securitypolicyviolation, so a future
// regression shows up in client_errors instead of silently breaking.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace("https://", "wss://")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  // Launch scope: prototype routes closed until their features are real.
  // Config-level redirects work for both direct loads and client-side
  // navigation without throwing NEXT_REDIRECT into window.onerror (which
  // the page-level redirect() calls did — caught by client_errors).
  async redirects() {
    return [
      { source: "/bookings", destination: "/menu", permanent: false },
      { source: "/bookings/:id", destination: "/menu", permanent: false },
      { source: "/trip", destination: "/menu", permanent: false },
      { source: "/mypage/notifications", destination: "/settings", permanent: false },
      { source: "/mypage/reviews/new", destination: "/mypage/reviews", permanent: false },
      { source: "/kit", destination: "/kit/survey", permanent: false },
      { source: "/mypage", destination: "/menu", permanent: false },
    ];
  },
};

export default nextConfig;
