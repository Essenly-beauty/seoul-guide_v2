import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { BackButtonBordered } from "@/components/ui/back-button";
import { BottomNav } from "@/components/ui/bottom-nav";
import { COFFEE_EDITORIAL_SERIES } from "@/lib/generated/coffee-editorial";
import { routes } from "@/lib/routes";

const COFFEE_TONES = ["#69745e", "#987153", "#495c61", "#75646f"];

export function generateStaticParams() {
  return COFFEE_EDITORIAL_SERIES.map((series) => ({ slug: series.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const series = COFFEE_EDITORIAL_SERIES.find((item) => item.slug === slug);
  if (!series) return {};
  return {
    title: `${series.titleKo} — Coffee & Cafés`,
    description: series.dekKo,
    alternates: { canonical: `/coffee/${series.slug}` },
    openGraph: { title: series.titleKo, description: series.dekKo, type: "article" },
    robots: { index: false, follow: false },
  };
}

export default async function CoffeeSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = COFFEE_EDITORIAL_SERIES.find((item) => item.slug === slug);
  if (!series) notFound();

  return (
    <>
      <main className="app-scroll coffee-series-detail">
        <div
          className="coffee-detail-hero"
          style={{ "--coffee-tone": COFFEE_TONES[(series.priority - 1) % COFFEE_TONES.length] } as CSSProperties}
        >
          <div className="coffee-detail-back"><BackButtonBordered fallback={routes.coffee} /></div>
          <p className="label">COFFEE & CAFÉS · {String(series.priority).padStart(2, "0")}</p>
          <h1>{series.titleKo}</h1>
          <p>{series.dekKo}</p>
          <div className="coffee-detail-orbit" aria-hidden="true"><i /><i /><i /></div>
        </div>

        <article className="pad coffee-place-list">
          <div className="coffee-detail-intro">
            <p className="label">THE SELECTION</p>
            <p>{series.introduction}</p>
          </div>

          {series.places.map((place) => (
            <section className="coffee-place-row" key={place.canonicalPlaceId}>
              <div className="coffee-place-number">{String(place.order).padStart(2, "0")}</div>
              <div className="coffee-place-content">
                <p className="label">{place.district}</p>
                <h2>{place.name}</h2>
                <p>{place.body}</p>
                <div className="coffee-place-tags">
                  {place.attributes.slice(0, 3).map((attribute) => <span key={attribute}>{attribute.replaceAll("-", " ")}</span>)}
                </div>
                <details>
                  <summary>Before you go</summary>
                  <ul>{place.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
                </details>
              </div>
            </section>
          ))}

          <div className="coffee-publication-note">
            <p className="label">EDITOR&apos;S NOTE</p>
            <p>{series.publicationNote}</p>
          </div>
          <Link className="coffee-back-link" href={routes.coffee}>← 모든 커피 시리즈 보기</Link>
        </article>
      </main>
      <BottomNav active="blog" />
    </>
  );
}
