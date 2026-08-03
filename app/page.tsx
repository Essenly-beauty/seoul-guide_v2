import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

// Welcome / auth entry (Spotify onboarding reference, 2026-08-02; theme-aware
// + rebalanced layout 2026-08-03): brand lockup and pitch ride the upper
// half, the action cluster sits low, terms anchor the bottom.

const SOCIALS: { key: string; label: string; style?: React.CSSProperties; mark: React.ReactNode }[] = [
  {
    key: "google", label: "Google",
    mark: <span className="mono" aria-hidden="true" style={{ fontWeight: 700, background: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>G</span>,
  },
  {
    key: "apple", label: "Apple",
    mark: <span aria-hidden="true" style={{ fontWeight: 700 }}>&#63743;</span>,
  },
  {
    key: "kakao", label: "Kakao",
    style: { background: "#FEE500", borderColor: "#FEE500", color: "#191919" },
    mark: <span aria-hidden="true" style={{ fontWeight: 700 }}>K</span>,
  },
];

/** Faint concentric contour arcs — the reference's corner decoration. */
function Contours({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" style={{ position: "absolute", width: 260, height: 260, pointerEvents: "none", ...style }}>
      {[28, 52, 76, 100, 124].map((r) => (
        <circle key={r} cx="200" cy="0" r={r} fill="none" stroke="rgba(245, 88, 0, 0.12)" strokeWidth="1" />
      ))}
    </svg>
  );
}

export default function WelcomePage() {
  return (
    <div
      className="app-scroll"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: "48px 26px 28px",
        textAlign: "center",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <Contours style={{ top: 0, right: 0 }} />
      <Contours style={{ bottom: -60, left: -60, transform: "rotate(180deg)" }} />

      {/* hero — upper half */}
      <div style={{ marginTop: "auto", position: "relative" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
          <BrandMark size={68} />
          <BrandWordmark size={15} />
        </div>
        <h1 style={{ fontFamily: "var(--sans)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.28, marginTop: 32 }}>
          Seoul beauty, mapped<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <p className="muted" style={{ fontSize: 14.5, marginTop: 10, maxWidth: "30ch", marginInline: "auto", lineHeight: 1.55 }}>
          Salons, clinics, Olive Young and hidden spots — curated for travelers, in English.
        </p>
      </div>

      {/* action cluster — lower half */}
      <div style={{ marginTop: "auto", position: "relative" }}>
        <div className="row" style={{ gap: 10 }}>
          <Button href={routes.onboardingBasics} style={{ flex: 1 }}>
            Get started
          </Button>
          <Button variant="secondary" href={routes.map} style={{ flex: 1 }}>
            Sign in
          </Button>
        </div>

        <div className="row" style={{ gap: 10, margin: "22px 0 0", alignItems: "center" }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} aria-hidden="true" />
          <span className="caption dim">or continue with</span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} aria-hidden="true" />
        </div>
        <div className="row" style={{ gap: 10, justifyContent: "center", marginTop: 14 }}>
          {SOCIALS.map((s) => (
            <Button
              key={s.key}
              variant="secondary"
              aria-label={`Continue with ${s.label}`}
              style={{ flex: 1, maxWidth: 108, height: 48, padding: 0, borderRadius: 14, ...s.style }}
              href={routes.map}
            >
              {s.mark}
            </Button>
          ))}
        </div>
        <Link className="login-guest caption muted" style={{ display: "inline-block", marginTop: 20, textDecoration: "underline" }} href={routes.map}>
          Continue as guest
        </Link>
      </div>

      <p className="caption dim" style={{ marginTop: 28, position: "relative" }}>
        By continuing you agree to the{" "}
        <Link href={routes.legalTerms} style={{ textDecoration: "underline" }}>Terms</Link> and{" "}
        <Link href={routes.legalPrivacy} style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
      </p>
    </div>
  );
}
