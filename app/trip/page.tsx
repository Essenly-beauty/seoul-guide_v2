import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { Badge } from "@/components/ui/badge";
import { ListRow } from "@/components/ui/list-row";
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

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Your trips" count={1} />
          <ListRow
            media={<span className="ic"><Icon name="plane" size="sm" /></span>}
            title="Seoul Trip"
            caption={<span className="num">May 1, 2026 – May 6, 2026</span>}
            meta="Solo · 5 days"
            trailing={<Badge tone="accent">Active</Badge>}
          />
        </section>
      </div>
      <BottomNav active="map" />
    </>
  );
}
