import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconSprite } from "@/components/icon";
import { RouteProgress } from "@/components/ui/route-progress";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "MYSEOULDROP — Seoul Beauty Guide",
  description: "Free K-beauty travel guide + hair kit for your Seoul trip.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MYSEOULDROP",
  },
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
