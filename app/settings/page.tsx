import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { SectionHeader } from "@/components/ui/section-header";
import { SettingsRow } from "@/components/settings/settings-row";
import { routes } from "@/lib/routes";

export default function SettingsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Settings" />
      <div className="app-scroll pad stack pagev2 settings-hub">
        <section className="settings-group">
          <SectionHeader title="Personal" />
          <div className="settings-group-list">
            <SettingsRow icon="user" title="Account" href={routes.settingsAccount} />
            <SettingsRow icon="spa" title="Beauty profile" value="Skin & hair" href={routes.onboardingProfile} />
          </div>
        </section>

        <section className="settings-group">
          <SectionHeader title="App" />
          <div className="settings-group-list">
            <SettingsRow icon="mark" title="App preferences" value="Install, location, theme" href={routes.settingsApp} />
          </div>
        </section>

        <section className="settings-group">
          <SectionHeader title="Privacy & support" />
          <div className="settings-group-list">
            <SettingsRow icon="lock" title="Privacy & data" href={routes.settingsPrivacy} />
            <SettingsRow icon="cross" title="Help & support" href={routes.support} />
          </div>
        </section>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
