import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ChipGroup } from "@/components/ui/chip-group";
import { Icon, BrandMark } from "@/components/icon";
import { routes, sample } from "@/lib/routes";

export default function BookingsListPage() {
  const detail = routes.booking(sample.booking);
  return (
    <>
      <TopBar
        left={<BrandMark size={24} />}
        title="My Bookings"
        right={
          <Link className="iconbtn" href={routes.home} aria-label="Home">
            <Icon name="home" />
          </Link>
        }
      />
      <div className="app-scroll pad stack">
        <ChipGroup single wrap={false} items={["All 5", "Upcoming", "Action needed 1", "Past"]} defaultSelected={["All 5"]} />

        <Link className="card tap stack sm" href={detail}>
          <div className="row between">
            <span className="statuschip pending">Reschedule pending</span>
            <span className="dday" style={{ color: "var(--warning)" }}>D-2</span>
          </div>
          <div><b>Eden Head Spa</b> <span className="caption muted mono">에덴 헤드스파</span></div>
          <div className="small muted mono">Wed, May 6 · 18:00 → 20:00 · Hair Therapy</div>
          <p className="caption muted">Waiting for Eden to approve your time change. Original time held until then.</p>
        </Link>

        <Link className="card tap stack sm" href={detail}>
          <div className="row between">
            <span className="statuschip confirmed">Confirmed</span>
            <span className="dday">D-5</span>
          </div>
          <div><b>HOSU DOSAN</b> <span className="caption muted mono">호수 도산점</span></div>
          <div className="small muted mono">Mon, May 4 · 14:00 · Signature Scalp Therapy</div>
          <p className="caption muted">Free cancellation until Sun, May 3 · 14:00.</p>
        </Link>

        <Link className="card tap stack sm" href={detail}>
          <div className="row between">
            <span className="statuschip confirmed">Confirmed</span>
            <span className="pill-today">Today</span>
          </div>
          <div><b>Juno Hair Gangnam</b> <span className="caption muted mono">준오헤어 강남점</span></div>
          <div className="small muted mono">Today · 18:00 · K-pop Cut + Color</div>
          <p className="caption muted">Within 24h — deposit non-refundable. Reschedule available (1 attempt).</p>
        </Link>

        <Link className="card tap stack sm" href={detail}>
          <div className="row between"><span className="statuschip completed">Completed</span></div>
          <div><b>La Beauté Coréenne</b> <span className="caption muted mono">라 보떼 꼬레엔느</span></div>
          <div className="small muted mono">Apr 22 · 11:00 · Premium Treatment</div>
        </Link>

        <div className="card stack sm" style={{ opacity: 0.7 }}>
          <div className="row between"><span className="statuschip cancelled">Cancelled · Refunded</span></div>
          <div><b>Salon de Cheveux</b> <span className="caption muted mono">살롱 드 슈브</span></div>
          <div className="small muted mono">Apr 18 · 16:00 · Express Refresh</div>
          <p className="caption muted">₩22,500 refunded to your card on Apr 16.</p>
        </div>

        <div className="card accent stack sm">
          <b className="serif h3">Looking for somewhere new?</b>
          <p className="small muted">Curated head spas, salons, and clinics for foreign visitors.</p>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn sm" href={routes.placesCategory("head_spa")}>Browse Head Spa</Link>
            <Link className="btn sm ghost" href={routes.home}>All Categories</Link>
          </div>
        </div>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
