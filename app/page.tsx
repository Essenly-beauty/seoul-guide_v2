import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { WelcomeHero } from "@/components/brand/welcome-hero";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

// Welcome / auth entry. Three bands, top to bottom: a map hero carrying the
// brand lockup, the pitch, then the action cluster pinned to the bottom.
// Fully theme-aware — the earlier forced-dark canvas mixed light tokens into
// unreadable text (2026-08-03).

const SOCIALS: { key: string; label: string; className?: string; mark: React.ReactNode }[] = [
  {
    key: "google", label: "Google",
    mark: <span className="mono" aria-hidden="true" style={{ fontWeight: 700, background: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>G</span>,
  },
  {
    key: "apple", label: "Apple",
    mark: <span aria-hidden="true" style={{ fontWeight: 700 }}>&#63743;</span>,
  },
  {
    key: "kakao", label: "Kakao", className: "welcome-social-kakao",
    mark: <span aria-hidden="true" style={{ fontWeight: 700 }}>K</span>,
  },
];

export default function WelcomePage() {
  return (
    <div className="welcome-screen app-scroll">
      <div className="welcome-lockup">
        <BrandMark size={64} />
        <BrandWordmark size={15} />
      </div>

      <h1 className="welcome-title">
        Seoul beauty, mapped<span style={{ color: "var(--accent)" }}>.</span>
      </h1>
      <p className="welcome-sub">
        Salons, clinics, Olive Young and hidden spots — curated for travelers, in English.
      </p>

      <div className="welcome-preview">
        <WelcomeHero />
      </div>

      <div className="welcome-actions">
        <div className="row" style={{ gap: 10 }}>
          <Button href={routes.onboardingBasics} style={{ flex: 1 }}>Get started</Button>
          <Button variant="secondary" href={routes.map} style={{ flex: 1 }}>Sign in</Button>
        </div>

        <div className="welcome-divider">
          <span className="caption dim">or continue with</span>
        </div>
        <div className="row welcome-socials">
          {SOCIALS.map((s) => (
            <Button
              key={s.key}
              variant="secondary"
              className={["welcome-social", s.className].filter(Boolean).join(" ")}
              aria-label={`Continue with ${s.label}`}
              href={routes.map}
            >
              {s.mark}
            </Button>
          ))}
        </div>

        <Link className="login-guest caption muted welcome-guest" href={routes.map}>
          Continue as guest
        </Link>
        <p className="caption dim welcome-terms">
          By continuing you agree to the{" "}
          <Link href={routes.legalTerms}>Terms</Link> and{" "}
          <Link href={routes.legalPrivacy}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
