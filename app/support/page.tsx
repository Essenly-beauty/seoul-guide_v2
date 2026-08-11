import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { routes } from "@/lib/routes";

const FAQ = [
  { q: "How do I book a beauty place?", a: "Open a place detail page and use the available contact or booking request action. MYSEOULDROP helps you check traveler-friendly details before you go." },
  { q: "Can MYSEOULDROP help if a salon does not speak English?", a: "Use the place detail page to show Korean names, addresses, and service notes. For extra help, contact MYSEOULDROP support with the place name and your preferred visit time." },
  { q: "How does the free hair kit work?", a: "Complete the short hair profile survey. If the kit program is available during your trip, MYSEOULDROP will guide you to the pickup or delivery details." },
  { q: "Why does the map ask for my location?", a: "Location permission is used only to show nearby beauty spots in Seoul. If you decline, the map falls back to central Seoul." },
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
