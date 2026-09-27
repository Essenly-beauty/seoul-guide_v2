import { PwaInstallControl } from "@/components/pwa/pwa-install-control";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/routes";

export const metadata = { title: "Install MYSEOULDROP" };

/** Public, shareable install page. It remains useful before native-store URLs exist. */
export default function DownloadPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.map} />} title="Install app" />
      <main className="app-scroll pad stack pagev2" style={{ justifyContent: "center", minHeight: 0, textAlign: "center", paddingTop: 48 }}>
        <div className="stack sm" style={{ alignItems: "center" }}>
          <BrandMark size={68} />
          <BrandWordmark size={15} />
          <h1 className="h1" style={{ marginTop: 18 }}>Install MYSEOULDROP</h1>
          <p className="t-caption muted" style={{ maxWidth: 340 }}>
            There is no file to download. The app goes straight onto your Home Screen and opens without the browser bars.
          </p>
          {/* One button. What it does depends on the browser, and the control
              decides: the real install prompt where one exists, a guided
              sheet that points at the Share icon where it does not. The
              paragraphs that used to sit under here repeated that sheet in
              prose, and the owner's test on a real phone showed nobody reads
              them (2026-09-27). */}
          <PwaInstallControl />
        </div>

        <section className="stack xs" style={{ marginTop: 12 }} aria-label="Native store availability">
          <span className="t-caption muted">App Store · coming soon</span>
          <span className="t-caption muted">Google Play · coming soon</span>
        </section>

        <Button variant="secondary" href={routes.map} style={{ alignSelf: "center", marginTop: 12 }}>
          Open the map
        </Button>
      </main>
    </>
  );
}
