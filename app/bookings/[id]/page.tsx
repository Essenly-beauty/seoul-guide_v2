import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { Icon } from "@/components/icon";
import { routes, sample } from "@/lib/routes";

export default function BookingDetailPage() {
  return (
    <>
      <TopBar
        left={<BackButton fallback={routes.bookings} />}
        title={<span className="mono" style={{ fontFamily: "var(--mono)", fontSize: 14 }}>HS-4F92A1</span>}
        right={
          <ActionButton className="iconbtn" aria-label="Share" share="My Essenly booking — HOSU DOSAN, Mon May 4, 14:00">
            <Icon name="share" size="sm" />
          </ActionButton>
        }
      />
      <div className="app-scroll pad stack">
        <div className="card stack sm">
          <div className="row between">
            <span className="label">Head Spa</span>
            <span className="row" style={{ gap: 8 }}>
              <span className="statuschip confirmed">Confirmed</span>
              <span className="dday">D-5</span>
            </span>
          </div>
          <div><b className="serif h3">HOSU DOSAN</b> <span className="caption muted mono">호수 도산점</span></div>
          <div className="kv"><span className="k">Service</span><span className="v" style={{ fontFamily: "var(--sans)" }}>Signature Scalp Therapy</span></div>
          <div className="kv"><span className="k">Duration</span><span className="v">90 min</span></div>
          <div className="kv"><span className="k">When</span><span className="v" style={{ fontFamily: "var(--sans)" }}>Mon, May 4 · 14:00</span></div>
          <div className="kv"><span className="k">Address</span><span className="v" style={{ fontFamily: "var(--sans)", textAlign: "right" }}>서울 강남구 도산대로 123</span></div>
          <div className="divider-accent" />
          <div className="kv"><span className="k">Deposit (paid)</span><span className="v" style={{ color: "var(--accent)" }}>₩45,000</span></div>
          <div className="kv"><span className="k">Balance at salon</span><span className="v">₩135,000</span></div>
        </div>

        <div className="banner accent">
          <Icon name="check" size="sm" />
          <span><b>Free cancellation</b> · Until Sun, May 3 · 14:00. Full refund and free reschedule before then.</span>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <ActionButton className="btn ghost" style={{ flex: 1 }} toast="Reschedule flow (stub)">Reschedule</ActionButton>
          <ActionButton className="btn danger" style={{ flex: 1 }} toast="Cancel — full refund (stub)">Cancel</ActionButton>
        </div>

        <div className="label">Getting there</div>
        <div className="linkgrid">
          <ActionButton className="linkbtn" toast="Opening KakaoMap…"><Icon name="pin" size="sm" />Kakao</ActionButton>
          <ActionButton className="linkbtn" toast="Opening Google Maps…"><Icon name="pin" size="sm" />Google</ActionButton>
          <ActionButton className="linkbtn" copy="호수 도산점, 서울 강남구 도산대로 123"><Icon name="car" size="sm" />Taxi</ActionButton>
        </div>

        <div className="card stack sm">
          <b>Talk to HOSU DOSAN</b>
          <p className="caption muted">Ask about parking, English, what to bring.</p>
          <ActionButton className="listrow" style={{ padding: "10px 0" }} toast="Opening KakaoTalk…">
            <span className="ic"><Icon name="pin" size="sm" /></span>
            <div><b>KakaoTalk Channel</b><div className="caption muted">Most Korean salons reply here fastest</div></div>
            <Icon name="chev" size="sm" className="chev" />
          </ActionButton>
          <ActionButton className="listrow" style={{ padding: "10px 0", borderBottom: "none" }} toast="Ask Essenly concierge">
            <span className="ic" style={{ background: "var(--accent)", color: "#fff" }}><Icon name="check" size="sm" /></span>
            <div><b style={{ color: "var(--accent)" }}>Ask Essenly concierge</b><div className="caption muted">We answer in English within a few hours</div></div>
            <Icon name="chev" size="sm" className="chev" />
          </ActionButton>
        </div>

        <Link className="card tap row between" href={routes.place(sample.place)}>
          <b>View place details</b>
          <Icon name="chev" size="sm" style={{ color: "var(--dim)" }} />
        </Link>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
