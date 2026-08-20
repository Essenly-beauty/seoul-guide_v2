"use client";

import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/section-header";
import { SignoutModal } from "@/components/ui/signout-modal";
import { SettingsRow } from "@/components/settings/settings-row";
import { PhoneVerify } from "@/components/auth/phone-verify";
import { displayName, useAuthUser } from "@/lib/auth/use-auth";
import { PHONE_VERIFICATION_AVAILABLE } from "@/lib/phone";
import { routes } from "@/lib/routes";

export default function AccountSettingsPage() {
  const { user, loading } = useAuthUser();

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.settings} />} title="Account" />
      <div className="app-scroll pad stack pagev2 settings-detail">
        {loading ? (
          <div className="settings-loading" aria-label="Loading account" />
        ) : !user ? (
          <div className="stack">
            <Notice icon="user">Sign in to manage your name, email, and account access.</Notice>
            <Button href={`${routes.signIn}?next=${routes.settingsAccount}`}>Sign in</Button>
          </div>
        ) : (
          <>
            <section className="settings-group">
              <SectionHeader title="Profile & sign-in" />
              <div className="settings-group-list">
                <SettingsRow icon="user" title="Display name" value={displayName(user)} href={routes.settingsName} />
                <SettingsRow icon="ext" title="Email address" value={user.email ?? "Not set"} href={routes.settingsEmail} />
              </div>
            </section>

            {PHONE_VERIFICATION_AVAILABLE && (
              <section className="settings-group">
                <SectionHeader title="Phone number" />
                <div className="settings-panel stack sm">
                  <p className="t-caption">Verify a number for account recovery and future bookings.</p>
                  <PhoneVerify />
                </div>
              </section>
            )}

            <section className="settings-group settings-account-actions">
              <SectionHeader title="Account access" />
              <div className="settings-group-list">
                <Button className="settings-switch-account" variant="secondary" href="/login?switch=1">
                  Log in with a different account
                </Button>
                <SignoutModal menuRow />
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
