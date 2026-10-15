import Link from "next/link";
import type { CSSProperties } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { TopBar } from "@/components/ui/top-bar";
import { COFFEE_EDITORIAL_SERIES } from "@/lib/generated/coffee-editorial";
import { routes } from "@/lib/routes";

const COFFEE_TONES = ["#69745e", "#987153", "#495c61", "#75646f"];

export default function CoffeeEditorialPage() {
  return (
    <>
      <TopBar center title="Coffee & Cafés" />
      <main className="app-scroll coffee-editorial-index">
        <header className="coffee-editorial-hero pad">
          <p className="label">A DROP OF SEOUL · EDITORIAL PREVIEW</p>
          <h1>오늘의 서울을<br /><em>카페로 고르는 법.</em></h1>
          <p>작업할 창가부터 아침의 첫 커피, 노을을 기다리는 루프톱까지. 장소보다 먼저 오늘의 상황을 골라보세요.</p>
          <div className="coffee-editorial-stats" aria-label="Editorial collection summary">
            <span><b>{COFFEE_EDITORIAL_SERIES.length}</b> stories</span>
            <span><b>{COFFEE_EDITORIAL_SERIES.reduce((sum, series) => sum + series.places.length, 0)}</b> selections</span>
            <span><b>Seoul</b> only</span>
          </div>
        </header>

        <section className="pad coffee-editorial-grid" aria-label="Coffee editorial series">
          {COFFEE_EDITORIAL_SERIES.map((series, index) => (
            <Link
              className="coffee-series-card"
              href={routes.coffeeSeries(series.slug)}
              key={series.id}
              style={{ "--coffee-tone": COFFEE_TONES[index % COFFEE_TONES.length] } as CSSProperties}
            >
              <div className="coffee-series-art" aria-hidden="true">
                <span>{String(series.priority).padStart(2, "0")}</span>
                <i />
              </div>
              <div className="coffee-series-copy">
                <p className="label">{series.occasionTags.slice(0, 2).join(" · ")}</p>
                <h2>{series.titleKo}</h2>
                <p>{series.dekKo}</p>
                <span className="coffee-series-link">6 places <b aria-hidden="true">→</b></span>
              </div>
            </Link>
          ))}
        </section>

        <aside className="pad coffee-editorial-note">
          <p className="label">ABOUT THIS PREVIEW</p>
          <p>리서치가 완료된 장소를 편집 관점으로 묶은 초안입니다. 영업시간과 이용 규칙은 공개 전에 다시 확인합니다.</p>
        </aside>
      </main>
      <BottomNav active="blog" />
    </>
  );
}
