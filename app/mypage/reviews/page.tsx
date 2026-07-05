import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { routes, sample } from "@/lib/routes";

export default function MyReviewsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.mypage} />} title="My reviews" />
      <div className="app-scroll pad stack">
        <div>
          <h2 className="h2">Your reviews</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            Reviews show on each place&apos;s page and help future Essenly travelers pick wisely.
          </p>
        </div>

        <div className="label">Awaiting your review</div>
        <div className="card row between">
          <div><b>Eden Head Spa</b><div className="caption muted mono">Apr 22 · HS-8B14D2</div></div>
          <Link className="btn sm outline" href={routes.booking(sample.booking)}>Write →</Link>
        </div>

        <div className="label">Written</div>
        <Link className="card tap" href={routes.place(sample.place)}>
          <div className="row between"><b>HOSU DOSAN</b><span className="stars">★★★★★</span></div>
          <div className="name-kr mono caption">호수 도산점</div>
          <p className="small muted" style={{ marginTop: 6 }}>
            The scalp diagnosis was so thorough. They had a translator app ready and walked me through every step. Apgujeong vibes — premium but not snobby.
          </p>
          <div className="caption dim mono" style={{ marginTop: 6 }}>Apr 18, 2026</div>
        </Link>
        <Link className="card tap" href={routes.place(sample.place)}>
          <div className="row between"><b>Juno Hair Gangnam</b><span className="stars">★★★★☆</span></div>
          <div className="name-kr mono caption">준오헤어 강남점</div>
          <p className="small muted" style={{ marginTop: 6 }}>
            Got the K-pop layered cut. Stylist understood my reference photo immediately (showed via Essenly Style refs). Took 2 hours instead of 90min, but the result is exactly what I wanted.
          </p>
          <div className="caption dim mono" style={{ marginTop: 6 }}>Apr 12, 2026</div>
        </Link>
      </div>
      <BottomNav active="my" />
    </>
  );
}
