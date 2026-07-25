import Link from "next/link";
import { BrandMark } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

const SOCIALS: { key: string; label: string; style?: React.CSSProperties; mark: React.ReactNode }[] = [
  {
    key: "google", label: "Continue with Google",
    mark: <span className="mono" aria-hidden="true" style={{ fontWeight: 700, background: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>G</span>,
  },
  {
    key: "apple", label: "Continue with Apple",
    mark: <span aria-hidden="true" style={{ fontWeight: 700 }}>&#63743;</span>,
  },
  {
    key: "kakao", label: "Continue with Kakao",
    style: { background: "#FEE500", borderColor: "#FEE500", color: "#191919" },
    mark: <span aria-hidden="true" style={{ fontWeight: 700 }}>K</span>,
  },
];

export default function LoginPage() {
  return (
    <div
      className="app-scroll"
      style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 26px", textAlign: "center", background: "radial-gradient(120% 60% at 50% 0%,#eaf5f1,transparent),var(--bg)" }}
    >
      <div style={{ margin: "auto 0" }}>
        <BrandMark size={84} style={{ margin: "0 auto 12px", display: "block" }} />
        <div className="hero" style={{ fontSize: 34 }}>
          Your personal
          <br />
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty guide.</span>
        </div>
        <p className="muted" style={{ fontSize: 15, marginTop: 14, maxWidth: "26ch", marginInline: "auto" }}>
          Find clinics, salons and nail studios near you — in English.
        </p>
        <div className="stack" style={{ marginTop: 28 }}>
          {SOCIALS.map((s) => (
            <Button key={s.key} variant="secondary" style={s.style} href={routes.map}>
              {s.mark} {s.label}
            </Button>
          ))}
          <Link className="login-guest caption muted" style={{ marginTop: 6, textDecoration: "underline" }} href={routes.map}>
            Continue as guest
          </Link>
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
