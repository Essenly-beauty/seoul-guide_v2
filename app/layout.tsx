import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconSprite } from "@/components/icon";
import { RouteProgress } from "@/components/ui/route-progress";
import { ErrorReporterInit } from "@/components/system/error-reporter-init";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  metadataBase: new URL("https://seoul-guide-v2.vercel.app"),
  title: "MYSEOULDROP — Seoul Beauty Guide",
  description:
    "Seoul beauty, mapped. 600+ hair salons, Olive Young stores, and beauty spots on one map — with subway routes and filters built for travelers.",
  applicationName: "MYSEOULDROP",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MYSEOULDROP",
  },
  openGraph: {
    type: "website",
    siteName: "MYSEOULDROP",
    title: "MYSEOULDROP — Seoul Beauty Guide",
    description:
      "Seoul beauty, mapped. 600+ hair salons, Olive Young stores, and beauty spots on one map.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MYSEOULDROP — Seoul Beauty Guide",
    description:
      "Seoul beauty, mapped. 600+ hair salons, Olive Young stores, and beauty spots on one map.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f6f7f9", // light default; ThemeProvider swaps it for dark users
};

/** Applies the stored theme before first paint — no light/dark flash. */
// Light is the service default (user decision 2026-08-15) — only an explicit
// stored "dark" keeps the dark tokens; everyone else gets light pre-paint.
const THEME_BOOT = `(function(){var d=false;try{d=localStorage.getItem("essenly.theme")==="dark"}catch(e){}if(!d)document.documentElement.setAttribute("data-theme","light")})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_BOOT stamps data-theme before React
    // hydrates — the attribute mismatch is intentional (next-themes pattern)
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <IconSprite />
        <ErrorReporterInit />
        <ThemeProvider>
          <ToastProvider>
            <div className="app-shell">
              <RouteProgress />
              {children}
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
