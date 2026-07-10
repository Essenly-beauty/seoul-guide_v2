import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function TripPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.home} />} title="My Trips" />
      <div className="app-scroll pad stack">
        <ActionButton className="empty" toast="Trip planner coming soon">
          <div className="ic"><Icon name="plane" size="sm" /></div>
          <b>Plan a New Trip</b>
          <p className="caption" style={{ marginTop: 4 }}>Sets your dates + travel type.</p>
        </ActionButton>

        <div className="card stack sm">
          <div className="row between">
            <b>Seoul Trip</b>
            <span className="badge accent">Active</span>
          </div>
          <div className="small muted mono">May 1, 2026 – May 6, 2026</div>
          <div className="caption muted">Solo · 5 days</div>
        </div>
      </div>
      <BottomNav active="map" />
    </>
  );
}
