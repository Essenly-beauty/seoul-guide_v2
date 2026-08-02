import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconSprite } from "@/components/icon";
import { RouteProgress } from "@/components/ui/route-progress";
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
  themeColor: "#FAFBFD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IconSprite />
        <ToastProvider>
          <div className="app-shell">
            <RouteProgress />
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
