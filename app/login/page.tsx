"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { routes } from "@/lib/routes";

export default function SignInPage() {
  const router = useRouter();
  const [reveal, setReveal] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  return (
    <AuthShell
      title="Sign in"
      support={<>If you need any support <Link className="auth-link" href={routes.support}>click here</Link></>}
      foot={<>Not a member? <Link className="auth-link" href={routes.register}>Register now</Link></>}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); router.push(routes.map); }}
        style={{ display: "contents" }}
      >
        <div className="auth-fields">
          <input
            className="auth-field"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter username or email"
            aria-label="Username or email"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <div className="auth-field-wrap">
            <input
              className="auth-field"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              style={{ paddingRight: 58 }}
            />
            <button
              type="button"
              className="auth-field-toggle"
              aria-label={reveal ? "Hide password" : "Show password"}
              aria-pressed={reveal}
              onClick={() => setReveal((v) => !v)}
            >
              <EyeGlyph off={!reveal} />
            </button>
          </div>
        </div>

        <Link className="auth-aside" href={routes.support}>Recovery password</Link>
        <button className="auth-cta" type="submit">Sign In</button>
      </form>
    </AuthShell>
  );
}
