import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { StatusChip } from "@/components/ui/chip";
import { Collapse } from "@/components/ui/collapse";
import { SectionHeader } from "@/components/ui/section-header";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function KitStatusPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="My Kit Request" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="Current request" />
          <div className="row" style={{ gap: 8 }}>
            <StatusChip status="pending">Submitted</StatusChip>
            <span className="t-caption num mono" style={{ marginLeft: "auto" }}>Apr 4, 2026</span>
          </div>
          <div className="inforow">
            <Icon name="gift" size="xs" />
            <span>Method</span>
            <span className="t-caption chev">Cafe Pickup</span>
          </div>
          <div className="inforow">
            <Icon name="pin" size="xs" />
            <span>Location</span>
            <span className="t-caption chev">Hongdae</span>
          </div>
          <div className="banner accent">
            <Icon name="check" size="sm" />
            <span><b>Preparing</b> · We&apos;ll notify you when your kit is ready for pickup (usually 2–3 days).</span>
          </div>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <Collapse summary={<b>Previous requests (1)</b>}>
            <div className="listrow v2">
              <StatusChip status="cancelled">Expired</StatusChip>
              <span className="t-caption num mono" style={{ marginLeft: "auto" }}>Feb 12, 2026</span>
            </div>
          </Collapse>
        </section>

        <p className="t-caption dim" style={{ textAlign: "center", marginTop: 6 }}>Questions? hello@essenly.com</p>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
