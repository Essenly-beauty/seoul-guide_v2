// Self-hosted web fonts (next/font: downloaded at build time, served from
// /_next/static with size-adjusted fallbacks — no request to Google from the
// visitor's browser, no swap-induced layout shift). globals.css consumes the
// CSS variables; the root layout stamps them on <html>.
//
// Korean place names are rendered with the system Hangul font on purpose:
// a CJK web font is hundreds of KB, which travellers on roaming data pay for.

import { Fraunces, Geist_Mono, Michroma, Plus_Jakarta_Sans } from "next/font/google";

export const serif = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-serif",
});

export const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const mono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const display = Michroma({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

export const fontVariables = [serif.variable, sans.variable, mono.variable, display.variable].join(" ");
