import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // session/token endpoints and account-only pages have no crawl value
      disallow: ["/auth/", "/reset-password", "/mypage", "/settings"],
    },
    sitemap: "https://seoul-guide-v2.vercel.app/sitemap.xml",
  };
}
