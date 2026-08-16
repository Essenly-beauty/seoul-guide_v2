import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { SignoutModal } from "@/components/ui/signout-modal";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AccountDataControls } from "@/components/settings/account-data-controls";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

// Launch scope: the old hair/skin/trip form here was unwired demo controls
// with a fake "Save Changes" toast — removed. Real beauty-profile editing
// lives in onboarding and the Menu tab's profile card (account-synced).
export default function SettingsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Settings" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="Beauty profile" />
          <p className="t-caption">Your hair, skin, and trip answers tune the map and rankings. Edit them from the profile card on the Menu tab.</p>
          <Button variant="secondary" size="sm" href={routes.onboardingInterests} style={{ alignSelf: "flex-start" }}>
            Edit beauty profile
          </Button>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Appearance" />
          <ThemeToggle />
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Data & privacy" />
          <AccountDataControls />
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="About" />
          <div>
            <Link className="listrow v2" href={routes.legalTerms}>
              <span className="ic"><Icon name="lock" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>Terms of Service</b>
              <Icon name="chev" size="xs" className="chev" />
            </Link>
            <Link className="listrow v2" href={routes.legalPrivacy}>
              <span className="ic"><Icon name="lock" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>Privacy Policy</b>
              <Icon name="chev" size="xs" className="chev" />
            </Link>
            <FeedbackLauncher className="listrow v2" style={{ width: "100%" }}>
              <span className="ic"><Icon name="ext" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0, textAlign: "left" }}>Send feedback</b>
              <Icon name="chev" size="xs" className="chev" />
            </FeedbackLauncher>
          </div>
        </section>

        <div className="stack sm">
          <Button variant="secondary" href="/login?switch=1">
            Log in with a different account
          </Button>
          <SignoutModal />
        </div>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
