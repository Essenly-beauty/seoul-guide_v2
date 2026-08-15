"use client";

import { useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { MoonGlyph, SunGlyph } from "@/components/brand/auth-glyphs";
import { WelcomeHero } from "@/components/brand/welcome-hero";
import { useTheme, type AppTheme } from "@/components/theme/theme-provider";
import { routes } from "@/lib/routes";

/** Theme picker (Figma 58:1344) — the choice applies live, so the screen
    itself previews what you're picking. */
export default function ChooseModePage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  // light first — it's the service default (2026-08-15)
  const modes: { value: AppTheme; label: string; glyph: React.ReactNode }[] = [
    { value: "light", label: "Light mode", glyph: <SunGlyph /> },
    { value: "dark", label: "Dark mode", glyph: <MoonGlyph /> },
  ];

  return (
    <div className="auth-screen app-scroll">
      <div className="auth-top">
        <BackButton fallback={routes.welcome} />
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <BrandMark size={30} />
          <BrandWordmark size={11} />
        </div>
        <span aria-hidden="true" />
      </div>

      <div className="welcome-preview" style={{ marginTop: 26 }}>
        <WelcomeHero />
      </div>

      <h1 className="auth-title" style={{ marginTop: 30, fontSize: 24 }}>Choose mode</h1>

      <div className="mode-options" role="group" aria-label="App theme">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            className="mode-option"
            aria-pressed={theme === m.value}
            onClick={() => setTheme(m.value)}
          >
            <span className="mode-orb">{m.glyph}</span>
            <span className="mode-label">{m.label}</span>
          </button>
        ))}
      </div>

      {/* auto margin lives on the wrapper so the CTA keeps clear air above it */}
      <div style={{ marginTop: "auto", paddingTop: 36 }}>
        <button
          className="auth-cta"
          style={{ marginTop: 0 }}
          type="button"
          onClick={() => router.push(routes.onboardingBasics)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
