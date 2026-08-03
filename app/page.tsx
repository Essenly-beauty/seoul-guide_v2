import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { WelcomeHero } from "@/components/brand/welcome-hero";
import { routes } from "@/lib/routes";

// Welcome / auth entry, following the Figma reference (58:1239 + 58:1358):
// lockup, pitch, a full-width visual, then one chunky brand CTA beside a
// plain sign-in link. The reference's photo band is our map preview — it
// shows the product instead of decorating around it. Theme-aware throughout.
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
        <div className="welcome-cta-row">
          <Link className="auth-cta welcome-cta" href={routes.register}>Get started</Link>
          <Link className="welcome-signin" href={routes.signIn}>Sign in</Link>
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
