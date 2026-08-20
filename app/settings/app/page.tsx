import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PwaInstallControl } from "@/components/pwa/pwa-install-control";
import { routes } from "@/lib/routes";

export default function AppPreferencesPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.settings} />} title="App preferences" />
      <div className="app-scroll pad stack pagev2 settings-detail">
        <section className="stack sm">
          <SectionHeader title="Install app" />
          <p className="t-caption">Save MYSEOULDROP to your phone or desktop for an app-like, full-screen experience.</p>
          <PwaInstallControl />
        </section>

        <SectionDivider />
        <section id="location" className="stack sm">
          <SectionHeader title="Location access" />
          <p className="t-caption">The map uses your browser’s location permission to center nearby places. If it is blocked, allow location for this site in your browser settings, then try again.</p>
          <p className="t-caption">iPhone: Settings → Privacy & Security → Location Services → your browser. Android: browser site settings → Location → Allow.</p>
          <Button variant="secondary" size="sm" href={routes.map} style={{ alignSelf: "flex-start" }}>
            Return to map and retry
          </Button>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Appearance" />
          <ThemeToggle />
        </section>
      </div>
    </>
  );
}
