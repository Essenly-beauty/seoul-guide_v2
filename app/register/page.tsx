"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { routes } from "@/lib/routes";

export default function RegisterPage() {
  const router = useRouter();
  const [reveal, setReveal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AuthShell
      title="Register"
      support={<>If you need any support <Link className="auth-link" href={routes.support}>click here</Link></>}
      foot={<>Do you have an account? <Link className="auth-link" href={routes.signIn}>Sign in</Link></>}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); router.push(routes.onboardingMode); }}
        style={{ display: "contents" }}
      >
        <div className="auth-fields">
          <input
            className="auth-field"
            autoComplete="name"
            placeholder="Full name"
            aria-label="Full name"
            value={form.name}
            onChange={set("name")}
          />
          <input
            className="auth-field"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter email"
            aria-label="Email"
            value={form.email}
            onChange={set("email")}
          />
          <div className="auth-field-wrap">
            <input
              className="auth-field"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Password"
              aria-label="Password"
              value={form.password}
              onChange={set("password")}
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

        <button className="auth-cta" type="submit">Create account</button>
      </form>
    </AuthShell>
  );
}
