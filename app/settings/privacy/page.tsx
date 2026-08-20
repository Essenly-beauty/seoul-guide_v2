import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { AccountDataControls } from "@/components/settings/account-data-controls";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function PrivacySettingsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.settings} />} title="Privacy & data" />
      <div className="app-scroll pad stack pagev2 settings-detail">
        <section className="settings-group">
          <SectionHeader title="Policies" />
          <div className="settings-group-list">
            <Link className="settings-row" href={routes.legalTerms}>
              <span className="settings-row-icon"><Icon name="lock" size="xs" /></span>
              <span className="settings-row-title">Terms of Service</span>
              <Icon name="chev" size="xs" className="settings-row-chevron" />
            </Link>
            <Link className="settings-row" href={routes.legalPrivacy}>
              <span className="settings-row-icon"><Icon name="lock" size="xs" /></span>
              <span className="settings-row-title">Privacy Policy</span>
              <Icon name="chev" size="xs" className="settings-row-chevron" />
            </Link>
          </div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Your data" />
          <AccountDataControls />
        </section>
      </div>
    </>
  );
}
