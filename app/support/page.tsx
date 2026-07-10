import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
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
      <TopBar center left={<BackButton fallback={routes.mypage} />} title="Support" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">FAQ</div>
          <div className="h1">How can we <span style={{ fontStyle: "italic", color: "var(--accent)" }}>help?</span></div>
          <p className="muted small" style={{ marginTop: 6 }}>Check common questions or send us a message with your trip and place details.</p>
        </div>

        {FAQ.map((f) => (
          <details className="card" key={f.q}>
            <summary style={{ fontWeight: 600, cursor: "pointer", listStyle: "none" }}>{f.q}</summary>
            <p className="muted small" style={{ marginTop: 8 }}>{f.a}</p>
          </details>
        ))}

        <div className="card accent stack sm">
          <div className="label">Contact</div>
          <b className="serif h3">Ask Essenly support</b>
          <p className="small muted">We usually reply within a few hours. Include the place name, date, time, and what you need help with.</p>
          <ActionButton className="btn" toast="Opening mail to help@essenly.beauty…">Email help@essenly.beauty</ActionButton>
        </div>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
