import Link from "next/link";
import { BrandMark } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function SplashPage() {
  return (
    <div
      className="app-scroll"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "32px 26px",
        textAlign: "center",
        background: "radial-gradient(120% 60% at 50% 0%,#eaf5f1,transparent),var(--bg)",
      }}
    >
      <div style={{ margin: "auto 0" }}>
        <BrandMark size={84} style={{ margin: "0 auto 12px", display: "block" }} />
        <div className="hero" style={{ fontSize: 34 }}>
          Your personal
          <br />
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty guide.</span>
        </div>
        <p className="muted" style={{ fontSize: 15, marginTop: 14, maxWidth: "26ch", marginInline: "auto" }}>
          Curated Seoul beauty matched to your skin.
        </p>
        <div className="stack" style={{ marginTop: 28 }}>
          <Link className="btn ghost" href={routes.onboardingInterests}>
            <span
              className="mono"
              style={{
                fontWeight: 700,
                background: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              G
            </span>{" "}
            Continue with Google
          </Link>
          <Link className="btn" href={routes.home}>Dev Login (Skip to Home)</Link>
        </div>
        <p className="caption dim" style={{ marginTop: 18 }}>
          By continuing you agree to the{" "}
          <Link href={routes.legalTerms} style={{ textDecoration: "underline" }}>Terms</Link> and{" "}
          <Link href={routes.legalPrivacy} style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
