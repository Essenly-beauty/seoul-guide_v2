import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { routes } from "@/lib/routes";

// Launch audit P0-3: the survey collected email + lodging address without
// storing or fulfilling anything. The form (components/kit/kit-survey.tsx)
// returns when the kit program actually ships.
export default function KitSurveyPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Beauty Kit" />
      <main className="app-scroll pad stack pagev2">
        <div>
          <div className="label">Beauty Kit</div>
          <h1 className="h1">Not open <span style={{ fontStyle: "italic", color: "var(--accent)" }}>just yet.</span></h1>
        </div>
        <Notice icon="gift">
          The free MYSEOULDROP kit program hasn&apos;t launched. We&apos;re not
          collecting requests yet — when it opens, it will be announced in the app.
        </Notice>
        <Button variant="secondary" href={routes.map} style={{ alignSelf: "flex-start" }}>Explore the map instead</Button>
      </main>
      <BottomNav active="menu" />
    </>
  );
}
