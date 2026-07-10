import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Collapse } from "@/components/ui/collapse";
import { routes } from "@/lib/routes";

export default function KitStatusPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.mypage} />} title="My Kit Request" />
      <div className="app-scroll pad stack">
        <div className="card stack sm">
          <div className="row between">
            <span className="statuschip pending">Submitted</span>
            <span className="caption muted mono">Apr 4, 2026</span>
          </div>
          <div className="kv"><span className="k">Method</span><span className="v" style={{ fontFamily: "var(--sans)" }}>Cafe Pickup</span></div>
          <div className="kv"><span className="k">Location</span><span className="v" style={{ fontFamily: "var(--sans)" }}>Hongdae</span></div>
        </div>

        <div className="card accent stack sm">
          <div className="row" style={{ gap: 8 }}><span className="statuschip confirmed">Preparing</span></div>
          <p className="small muted">We&apos;ll notify you when your kit is ready for pickup (usually 2–3 days).</p>
        </div>

        <Collapse summary={<b>Previous requests (1)</b>}>
          <div className="card row between">
            <span className="statuschip cancelled">Expired</span>
            <span className="caption muted mono">Feb 12, 2026</span>
          </div>
        </Collapse>

        <p className="caption dim" style={{ textAlign: "center", marginTop: 6 }}>Questions? hello@essenly.com</p>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
