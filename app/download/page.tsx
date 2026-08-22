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
            There is no file to download. This adds MYSEOULDROP to your Home Screen straight from the browser, and your map, saved places, and account stay exactly where they are.
          </p>
          <PwaInstallControl />
        </div>

        <section className="stack sm" style={{ marginTop: 30, textAlign: "left" }}>
          <div>
            <b className="t-label-md">iPhone &amp; iPad</b>
            <p className="t-caption muted">Open this page in Safari, tap Share, then choose Add to Home Screen. iPhone does not show an in-page download prompt.</p>
          </div>
          <div>
            <b className="t-label-md">Android &amp; desktop</b>
            <p className="t-caption muted">Use the Install MYSEOULDROP button or your browser’s Install app menu.</p>
          </div>
        </section>

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
