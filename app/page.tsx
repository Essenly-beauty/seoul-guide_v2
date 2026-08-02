import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

// Welcome / auth entry (Spotify onboarding reference, 2026-08-02): dark field
// with faint contour-line decoration, brand lockup centered high, headline +
// sub-copy, a filled brand CTA beside a quiet sign-in, socials beneath.

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
        <circle key={r} cx="200" cy="0" r={r} fill="none" stroke="rgba(245, 88, 0, 0.10)" strokeWidth="1" />
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
        justifyContent: "center",
        padding: "40px 26px",
        textAlign: "center",
        background: "#0a0b0d",
        overflow: "hidden",
      }}
    >
      <Contours style={{ top: 0, right: 0 }} />
      <Contours style={{ bottom: -60, left: -60, transform: "rotate(180deg)" }} />

      <div style={{ margin: "auto 0", position: "relative" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 12, marginBottom: 34 }}>
          <BrandMark size={72} />
          <BrandWordmark size={16} />
        </div>

        <h1 style={{ fontFamily: "var(--sans)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
          Seoul beauty, mapped<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <p className="muted" style={{ fontSize: 14.5, marginTop: 10, maxWidth: "30ch", marginInline: "auto", lineHeight: 1.55 }}>
          Salons, clinics, Olive Young and hidden spots — curated for travelers, in English.
        </p>

        <div className="row" style={{ gap: 8, marginTop: 30, justifyContent: "center" }}>
          <Button href={routes.onboardingBasics} style={{ flex: 1.4, maxWidth: 220 }}>
            Get started
          </Button>
          <Button variant="secondary" href={routes.map} style={{ flex: 1, maxWidth: 150 }}>
            Sign in
          </Button>
        </div>

        <div className="caption dim" style={{ margin: "26px 0 10px" }}>or continue with</div>
        <div className="row" style={{ gap: 10, justifyContent: "center" }}>
          {SOCIALS.map((s) => (
            <Button
              key={s.key}
              variant="secondary"
              aria-label={`Continue with ${s.label}`}
              style={{ width: 52, minWidth: 52, height: 48, padding: 0, borderRadius: 14, ...s.style }}
              href={routes.map}
            >
              {s.mark}
            </Button>
          ))}
        </div>
        <Link className="login-guest caption muted" style={{ display: "inline-block", marginTop: 18, textDecoration: "underline" }} href={routes.map}>
          Continue as guest
        </Link>
        <p className="caption dim" style={{ marginTop: 16 }}>
          By continuing you agree to the{" "}
          <Link href={routes.legalTerms} style={{ textDecoration: "underline" }}>Terms</Link> and{" "}
          <Link href={routes.legalPrivacy} style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
