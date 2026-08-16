import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { WelcomeSocials } from "@/components/auth/welcome-socials";
import { WelcomeHero } from "@/components/brand/welcome-hero";
import { supabaseServer } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

// Welcome / auth entry. Funnel order (user decision 2026-08-16): social
// sign-in first, email signup second, guest as a quiet escape hatch — the
// app works without an account, but the front door sells the account.
export default async function WelcomePage() {
  // Auto sign-in: a returning member lands in the app, not on the pitch.
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (user) redirect(routes.map);
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
        <WelcomeSocials />
        <Link className="auth-cta welcome-cta-full" href={routes.register}>
          Sign up with email
        </Link>
        <p className="caption muted" style={{ textAlign: "center", marginTop: 14 }}>
          <Link className="auth-link" href={routes.signIn}>Sign in</Link>
          <span className="dim" aria-hidden="true"> · </span>
          <Link className="welcome-guest" style={{ margin: 0 }} href={routes.map}>Continue as guest</Link>
        </p>
        <p className="caption dim welcome-terms">
          By continuing you agree to the{" "}
          <Link href={routes.legalTerms}>Terms</Link> and{" "}
          <Link href={routes.legalPrivacy}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
