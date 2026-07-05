"use client";

import { useEffect } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-scroll pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
      <h1 className="h1">Something went <span style={{ fontStyle: "italic", color: "var(--accent)" }}>sideways.</span></h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: "32ch", marginInline: "auto" }}>
        An unexpected error interrupted this screen. Your data is safe — try again.
      </p>
      {error.digest && <div className="caption dim mono" style={{ marginTop: 6 }}>Ref {error.digest}</div>}
      <div className="stack" style={{ marginTop: 22, maxWidth: 280, marginInline: "auto", width: "100%" }}>
        <button className="btn" onClick={reset}>Try again</button>
        <Link className="btn ghost" href={routes.home}>Back to Home</Link>
      </div>
    </main>
  );
}
