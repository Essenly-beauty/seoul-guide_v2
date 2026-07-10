import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { NotificationsForm } from "@/components/mypage/notifications-form";
import { routes } from "@/lib/routes";

export default function NotificationsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Notifications" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Notifications</div>
          <div className="h1">What can we <span style={{ fontStyle: "italic", color: "var(--accent)" }}>tell you about?</span></div>
          <p className="muted small" style={{ marginTop: 6 }}>Transactional booking confirmations always go through, even if you turn the booking category off.</p>
        </div>
        <NotificationsForm />
      </div>
      <BottomNav active="menu" />
    </>
  );
}
