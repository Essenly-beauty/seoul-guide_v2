import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { StatusChip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon } from "@/components/icon";
import { routes, sample } from "@/lib/routes";

export default function BookingDetailPage() {
  return (
    <>
      <TopBar
        left={<BackButton fallback={routes.bookings} />}
        title={<span className="mono" style={{ fontFamily: "var(--mono)", fontSize: 14 }}>HS-4F92A1</span>}
        right={
          <ActionButton
            iconAction={{ name: "share", label: "Share" }}
            share="My MYSEOULDROP booking — HOSU DOSAN, Mon May 4, 14:00"
          />
        }
      />
      <div className="app-scroll pad stack pagev2">
        {/* Booking summary */}
        <section className="stack sm">
          <div className="row" style={{ gap: 8 }}>
            <StatusChip status="confirmed" />
            <span className="dday">D-5</span>
            <span className="t-caption" style={{ marginLeft: "auto" }}>Head Spa</span>
          </div>
          <div className="row" style={{ gap: 7 }}>
            <CategoryBadge type="head_spa" size={18} />
            <b style={{ fontSize: 17 }}>HOSU DOSAN</b>
            <span className="t-caption mono">호수 도산점</span>
          </div>
          <div className="inforow">
            <Icon name="check" size="xs" />
            <span>Signature Scalp Therapy</span>
            <span className="t-caption chev num">90 min</span>
          </div>
          <div className="inforow">
            <Icon name="cal" size="xs" />
            <span className="num">Mon, May 4 · 14:00</span>
          </div>
          <div className="inforow">
            <Icon name="pin" size="xs" />
            <span style={{ minWidth: 0 }}>서울 강남구 도산대로 123</span>
            <ActionButton className="small chev" style={{ color: "var(--accent)", fontWeight: 600 }} copy="서울 강남구 도산대로 123" aria-label="Copy address">
              Copy
            </ActionButton>
          </div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Payment" />
          <div className="inforow">
            <span className="muted" style={{ width: 16, textAlign: "center", flex: "none" }} aria-hidden="true">₩</span>
            <span>Deposit (paid)</span>
            <span className="chev num" style={{ fontWeight: 600, color: "var(--accent)" }}>₩45,000</span>
          </div>
          <div className="inforow">
            <span className="muted" style={{ width: 16, textAlign: "center", flex: "none" }} aria-hidden="true">₩</span>
            <span>Balance at salon</span>
            <span className="chev num" style={{ fontWeight: 600 }}>₩135,000</span>
          </div>
          <Notice tone="accent" icon="check">
            <span><b>Free cancellation</b> · Until Sun, May 3 · 14:00. Full refund and free reschedule before then.</span>
          </Notice>
          <div className="row" style={{ gap: 8 }}>
            <ActionButton variant="secondary" style={{ flex: 1 }} toast="Reschedule flow (stub)">Reschedule</ActionButton>
            <CancelBookingButton />
          </div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Getting there" />
          <div className="linkgrid">
            <ActionButton className="linkbtn" toast="Opening KakaoMap…"><Icon name="pin" size="sm" />Kakao</ActionButton>
            <ActionButton className="linkbtn" toast="Opening Google Maps…"><Icon name="pin" size="sm" />Google</ActionButton>
            <ActionButton className="linkbtn" copy="호수 도산점, 서울 강남구 도산대로 123"><Icon name="car" size="sm" />Taxi</ActionButton>
          </div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Talk to HOSU DOSAN" />
          <p className="t-caption">Ask about parking, English, what to bring.</p>
          <div>
            <ActionButton className="listrow v2" toast="Opening KakaoTalk…">
              <span className="ic"><Icon name="pin" size="sm" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="t-label-md" style={{ fontSize: 14, display: "block" }}>KakaoTalk Channel</b>
                <div className="t-caption">Most Korean salons reply here fastest</div>
              </div>
              <Icon name="chev" size="xs" className="chev" />
            </ActionButton>
            <ActionButton className="listrow v2" toast="Ask MYSEOULDROP concierge">
              <span className="ic" style={{ background: "var(--accent)", color: "#fff" }}><Icon name="check" size="sm" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="t-label-md" style={{ fontSize: 14, display: "block", color: "var(--accent)" }}>Ask MYSEOULDROP concierge</b>
                <div className="t-caption">We answer in English within a few hours</div>
              </div>
              <Icon name="chev" size="xs" className="chev" />
            </ActionButton>
            <Link className="listrow v2" href={routes.place(sample.place)}>
              <span className="ic"><Icon name="ext" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>View place details</b>
              <Icon name="chev" size="xs" className="chev" />
            </Link>
          </div>
        </section>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
