import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { routes } from "@/lib/routes";

// Copy matches what the app actually does today (codex cross-check #5):
// no in-app booking, no kit program, no human support desk yet.
const FAQ = [
  { q: "Can I book through MYSEOULDROP?", a: "Not yet — MYSEOULDROP is a discovery map. Save places you like, check the details, and book at the venue or through its official channels. In-app booking is planned." },
  { q: "Can MYSEOULDROP help if a salon does not speak English?", a: "Every place page shows the Korean name and address with one-tap copy, plus a 'show to taxi driver' card. Showing the Korean name at the front desk works well." },
  { q: "Why does the map ask for my location?", a: "Location permission is used only to show nearby beauty spots in Seoul. If you decline, the map falls back to central Seoul." },
  { q: "Is my saved data tied to my account?", a: "Yes — favorites, ratings, and your beauty profile sync to your account when you sign in, and signing out removes them from the device." },
];

export default function SupportPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Support" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="How can we help?" />
          <p className="t-caption">Check common questions or send us a message with your trip and place details.</p>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="FAQ" count={FAQ.length} />
          <div>
            {FAQ.map((f) => (
              <details className="qa" key={f.q}>
                <summary>{f.q}</summary>
                <p className="t-caption">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Contact the team" />
          {/* Launch honesty: the @myseouldrop.com inbox doesn't exist yet
              (domain not purchased) and no reply SLA is real — feedback is
              the one channel that actually reaches us (Supabase inbox). */}
          <p className="t-caption">Feedback goes straight to the team&apos;s inbox. A direct support email is coming with our domain — for now this is the fastest way to reach us.</p>
          <FeedbackLauncher variant="secondary">Send feedback</FeedbackLauncher>
        </section>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
