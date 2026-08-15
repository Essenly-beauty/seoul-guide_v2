/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
