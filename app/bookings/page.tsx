import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import { ChipGroup } from "@/components/ui/chip-group";
import { ImgPh } from "@/components/ui/img-ph";
import { SectionHeader } from "@/components/ui/section-header";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon, BrandMark } from "@/components/icon";
import { routes, sample } from "@/lib/routes";
import type { PlaceType } from "@/lib/data";

type BookingRowData = {
  type: PlaceType;
  name: string;
  kr: string;
  when: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  statusLabel: string;
  note?: string;
  dday?: string;
  ddayWarn?: boolean;
  today?: boolean;
};

const UPCOMING: BookingRowData[] = [
  {
    type: "head_spa", name: "Eden Head Spa", kr: "에덴 헤드스파",
    when: "Wed, May 6 · 18:00 → 20:00 · Hair Therapy",
    status: "pending", statusLabel: "Reschedule pending", dday: "D-2", ddayWarn: true,
    note: "Waiting for Eden to approve your time change. Original time held until then.",
  },
  {
    type: "head_spa", name: "HOSU DOSAN", kr: "호수 도산점",
    when: "Mon, May 4 · 14:00 · Signature Scalp Therapy",
    status: "confirmed", statusLabel: "Confirmed", dday: "D-5",
    note: "Free cancellation until Sun, May 3 · 14:00.",
  },
  {
    type: "hair_salon", name: "Juno Hair Gangnam", kr: "준오헤어 강남점",
    when: "Today · 18:00 · K-pop Cut + Color",
    status: "confirmed", statusLabel: "Confirmed", today: true,
    note: "Within 24h — deposit non-refundable. Reschedule available (1 attempt).",
  },
];

const PAST: BookingRowData[] = [
  {
    type: "head_spa", name: "La Beauté Coréenne", kr: "라 보떼 꼬레엔느",
    when: "Apr 22 · 11:00 · Premium Treatment",
    status: "completed", statusLabel: "Completed",
  },
  {
    type: "hair_salon", name: "Salon de Cheveux", kr: "살롱 드 슈브",
    when: "Apr 18 · 16:00 · Express Refresh",
    status: "cancelled", statusLabel: "Cancelled · Refunded",
    note: "₩22,500 refunded to your card on Apr 16.",
  },
];

function BookingRowBody({ b }: { b: BookingRowData }) {
  return (
    <>
      <ImgPh className="thumb56" />
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <div className="row" style={{ gap: 6 }}>
          <CategoryBadge type={b.type} size={16} />
          <b className="t-label-md" style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</b>
          <span className="t-caption mono" style={{ flex: "none" }}>{b.kr}</span>
        </div>
        <div className="t-caption num">{b.when}</div>
        <div className="row" style={{ gap: 8 }}>
          <StatusChip status={b.status}>{b.statusLabel}</StatusChip>
          {b.dday && <span className="dday" style={b.ddayWarn ? { color: "var(--warning)" } : undefined}>{b.dday}</span>}
          {b.today && <span className="pill-today">Today</span>}
        </div>
        {b.note && <p className="t-caption">{b.note}</p>}
      </div>
    </>
  );
}

export default function BookingsListPage() {
  const detail = routes.booking(sample.booking);
  return (
    <>
      <TopBar
        left={<BrandMark size={24} />}
        title="My Bookings"
        right={
          /* raw iconbtn Link kept: <IconButton> renders a <button>, no href support (design-system migration, 2026-07-25) */
          <Link className="iconbtn" href={routes.map} aria-label="Home">
            <Icon name="home" />
          </Link>
        }
      />
      <div className="app-scroll pad stack pagev2">
        <ChipGroup ariaLabel="Booking status" single wrap={false} items={["All 5", "Upcoming", "Action needed 1", "Past"]} defaultSelected={["All 5"]} />

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Upcoming" count={UPCOMING.length} />
          <div>
            {UPCOMING.map((b) => (
              <Link key={b.name} className="listrow v2 top" href={detail}>
                <BookingRowBody b={b} />
                <Icon name="chev" size="xs" className="chev" />
              </Link>
            ))}
          </div>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Past" count={PAST.length} />
          <div>
            <Link className="listrow v2 top" href={detail}>
              <BookingRowBody b={PAST[0]} />
              <Icon name="chev" size="xs" className="chev" />
            </Link>
            <div className="listrow v2 top" style={{ opacity: 0.7 }}>
              <BookingRowBody b={PAST[1]} />
            </div>
          </div>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Looking for somewhere new?" />
          <p className="t-caption">Curated head spas, salons, and clinics for foreign visitors.</p>
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" href={routes.placesCategory("head_spa")}>Browse Head Spa</Button>
            {/* tonal: paired with the primary "Browse Head Spa" CTA (design-system §3) */}
            <Button variant="tonal" size="sm" href={routes.map}>All Categories</Button>
          </div>
        </section>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
