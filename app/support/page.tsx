import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { SectionHeader } from "@/components/ui/section-header";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { routes } from "@/lib/routes";

const FAQ = [
  { q: "How do I book a beauty place?", a: "Open a place detail page and use the available contact or booking request action. Essenly helps you check traveler-friendly details before you go." },
  { q: "Can Essenly help if a salon does not speak English?", a: "Use the place detail page to show Korean names, addresses, and service notes. For extra help, contact Essenly support with the place name and your preferred visit time." },
  { q: "How does the free hair kit work?", a: "Complete the short hair profile survey. If the kit program is available during your trip, Essenly will guide you to the pickup or delivery details." },
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

        <hr className="sec-divider" />
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

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Ask Essenly support" />
          <p className="t-caption">We usually reply within a few hours. Include the place name, date, time, and what you need help with.</p>
          <ActionButton className="btn" toast="Opening mail to help@essenly.beauty…">Email help@essenly.beauty</ActionButton>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Something off?" />
          <p className="t-caption">Spotted a bug or wrong place info? Tell us — it goes straight to the team.</p>
          <FeedbackLauncher className="btn ghost">Send feedback</FeedbackLauncher>
        </section>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
