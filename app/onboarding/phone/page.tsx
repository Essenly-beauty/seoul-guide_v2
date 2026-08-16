"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { PhoneVerify } from "@/components/auth/phone-verify";
import { routes } from "@/lib/routes";

/** Onboarding step: verify a phone number (SMS OTP). Skippable — travelers
    with flaky international SMS must never be walled out; Settings offers
    the same verification later. */
export default function OnboardingPhonePage() {
  const router = useRouter();
  return (
    <div className="auth-screen app-scroll">
      <div className="auth-top">
        <BackButton fallback={routes.onboardingBasics} />
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <BrandMark size={30} />
          <BrandWordmark size={11} />
        </div>
        <span aria-hidden="true" />
      </div>

      <h1 className="auth-title" style={{ marginTop: 30, fontSize: 24 }}>Verify your phone</h1>
      <p className="auth-support" style={{ lineHeight: 1.6 }}>
        Helps us keep accounts real, and will speed things up when bookings launch.
      </p>

      <div style={{ marginTop: 26 }}>
        <PhoneVerify onDone={() => router.push(routes.onboardingInterests)} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 36 }} className="stack sm">
        <Link className="caption muted" href={routes.onboardingInterests} style={{ textAlign: "center", textDecoration: "underline" }}>
          Skip for now
        </Link>
      </div>
    </div>
  );
}
