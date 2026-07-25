import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { SectionHeader } from "@/components/ui/section-header";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function TripPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.map} />} title="My Trips" />
      <div className="app-scroll pad stack pagev2">
        <ActionButton className="empty" toast="Trip planner coming soon">
          <div className="ic"><Icon name="plane" size="sm" /></div>
          <b>Plan a New Trip</b>
          <p className="caption" style={{ marginTop: 4 }}>Sets your dates + travel type.</p>
        </ActionButton>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Your trips" count={1} />
          <div className="listrow v2">
            <span className="ic"><Icon name="plane" size="sm" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="t-label-md" style={{ fontSize: 14, display: "block" }}>Seoul Trip</b>
              <div className="t-caption num">May 1, 2026 – May 6, 2026</div>
              <div className="t-caption">Solo · 5 days</div>
            </div>
            <span className="badge accent">Active</span>
          </div>
        </section>
      </div>
      <BottomNav active="map" />
    </>
  );
}
