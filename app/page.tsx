import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { GuestEntryButton } from "@/components/auth/guest-entry";
import { WelcomeHero } from "@/components/brand/welcome-hero";
import { supabaseServer } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

// Welcome / auth entry, following the Figma reference (58:1239 + 58:1358):
// lockup, pitch, a full-width visual, then one chunky brand CTA beside a
// plain sign-in link. The reference's photo band is our map preview — it
// shows the product instead of decorating around it. Theme-aware throughout.
export default async function WelcomePage() {
  // Auto sign-in: a returning member should land in the app, not on the
  // logged-out pitch (user report 2026-08-15 — "자동 로그인이 안 된다").
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (user) redirect(routes.map);
  // Returning guests skip the pitch too — "continue as guest" is a remembered
  // choice, not a toll booth on every visit (user request 2026-08-16).
  if ((await cookies()).get("essenly_guest")?.value === "1") redirect(routes.map);
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
        <GuestEntryButton />
        <p className="caption dim welcome-terms">
          By continuing you agree to the{" "}
          <Link href={routes.legalTerms}>Terms</Link> and{" "}
          <Link href={routes.legalPrivacy}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
