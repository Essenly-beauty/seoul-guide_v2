import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { SectionHeader } from "@/components/ui/section-header";
import { NotificationsForm } from "@/components/mypage/notifications-form";
import { routes } from "@/lib/routes";

export default function NotificationsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Notifications" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="What can we tell you about?" />
          <p className="t-caption">Transactional booking confirmations always go through, even if you turn the booking category off.</p>
        </section>
        <hr className="sec-divider" />
        <NotificationsForm />
      </div>
      <BottomNav active="menu" />
    </>
  );
}
