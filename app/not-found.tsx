import Link from "next/link";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="app-scroll pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
      <div className="iconbtn" aria-hidden="true" style={{ margin: "0 auto 14px", width: 56, height: 56, background: "var(--accent-soft)", borderRadius: "var(--r-full)" }}>
        <Icon name="pin" style={{ color: "var(--accent)" }} />
      </div>
      <h1 className="h1">This page <span style={{ fontStyle: "italic", color: "var(--accent)" }}>wandered off.</span></h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: "30ch", marginInline: "auto" }}>
        The link may be old, or the place may have moved. Let&apos;s get you back on the route.
      </p>
      <div className="stack" style={{ marginTop: 22, maxWidth: 280, marginInline: "auto", width: "100%" }}>
        <Link className="btn" href={routes.map}>Back to Home</Link>
        <Link className="btn ghost" href={routes.search}>Search Essenly</Link>
      </div>
    </main>
  );
}
