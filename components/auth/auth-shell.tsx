"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BackButton } from "@/components/ui/back-button";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { AppleGlyph, GoogleGlyph, KakaoGlyph } from "@/components/brand/auth-glyphs";
import { routes } from "@/lib/routes";

/** Chrome shared by Sign in and Register (Figma 58:1295 / 58:1319):
    back + lockup, title, support line, then the caller's form. */
export function AuthShell({ title, support, children, foot }: {
  title: string;
  support?: ReactNode;
  children: ReactNode;
  foot: ReactNode;
}) {
  return (
    <div className="auth-screen app-scroll">
      <div className="auth-top">
        <BackButton fallback={routes.welcome} />
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <BrandMark size={30} />
          <BrandWordmark size={11} />
        </div>
        <span aria-hidden="true" />
      </div>

      <h1 className="auth-title">{title}</h1>
      {support && <p className="auth-support">{support}</p>}

      {children}

      <div className="auth-or">or</div>
      <div className="auth-socials">
        <Link className="auth-social" href={routes.map} aria-label="Continue with Google"><GoogleGlyph /></Link>
        <Link className="auth-social" href={routes.map} aria-label="Continue with Apple"><AppleGlyph /></Link>
        <Link className="auth-social" href={routes.map} aria-label="Continue with Kakao" style={{ background: "#fee500" }}><KakaoGlyph /></Link>
      </div>

      <p className="auth-foot">{foot}</p>
    </div>
  );
}
