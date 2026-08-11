import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconSprite } from "@/components/icon";
import { RouteProgress } from "@/components/ui/route-progress";
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
  themeColor: "#0b0c0f",
};

/** Applies the stored theme before first paint — no light/dark flash. */
const THEME_BOOT = `try{if(localStorage.getItem("essenly.theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <IconSprite />
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
