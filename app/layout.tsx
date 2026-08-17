import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconSprite } from "@/components/icon";
import { RouteProgress } from "@/components/ui/route-progress";
import { ErrorReporterInit } from "@/components/system/error-reporter-init";
import { PwaRegister } from "@/components/system/pwa-register";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";


export const metadata: Metadata = {
  metadataBase: new URL("https://myseouldrop.app"),
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
