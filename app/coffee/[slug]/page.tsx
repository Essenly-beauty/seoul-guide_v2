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

export default async function CoffeeSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const series = COFFEE_EDITORIAL_SERIES.find((item) => item.slug === slug);
  if (!series) notFound();
  const isEnglish = query.lang === "en" && series.english;
  const title = isEnglish ? series.titleEn : series.titleKo;
  const dek = isEnglish ? series.english.dek : series.dekKo;

  return (
    <>
      <main className="app-scroll coffee-series-detail">
        <div
          className="coffee-detail-hero"
          style={{ "--coffee-tone": COFFEE_TONES[(series.priority - 1) % COFFEE_TONES.length] } as CSSProperties}
        >
          <div className="coffee-detail-back"><BackButtonBordered fallback={routes.coffee} /></div>
          {series.english ? (
            <div className="coffee-language-switch" aria-label="Article language">
              <Link aria-current={!isEnglish ? "page" : undefined} href={routes.coffeeSeries(series.slug)}>한국어</Link>
              <Link aria-current={isEnglish ? "page" : undefined} href={`${routes.coffeeSeries(series.slug)}?lang=en`}>EN</Link>
            </div>
          ) : null}
          <p className="label">COFFEE & CAFÉS · {String(series.priority).padStart(2, "0")}</p>
          <h1>{title}</h1>
          <p>{dek}</p>
          <div className="coffee-detail-orbit" aria-hidden="true"><i /><i /><i /></div>
        </div>

        <article className="pad coffee-place-list">
          <div className="coffee-detail-intro">
            <p className="label">THE SELECTION</p>
            <p>{isEnglish ? series.english.introduction : series.introduction}</p>
          </div>

          {series.places.map((place, index) => {
            const englishHeading = isEnglish ? series.english.placeHeadings[index].split(" · ") : null;
            return (
            <section className="coffee-place-row" key={place.canonicalPlaceId}>
              <div className="coffee-place-number">{String(place.order).padStart(2, "0")}</div>
              <div className="coffee-place-content">
                <p className="label">{englishHeading?.[1] ?? place.district}</p>
                <h2>{englishHeading?.[0] ?? place.name}</h2>
                <p>{isEnglish ? series.english.placeBodies[index] : place.body}</p>
                <div className="coffee-place-tags">
                  {place.attributes.slice(0, 3).map((attribute) => <span key={attribute}>{attribute.replaceAll("-", " ")}</span>)}
                </div>
                <details>
                  <summary>{isEnglish ? "Research notes · Korean" : "Before you go"}</summary>
                  <ul>{place.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
                </details>
              </div>
            </section>
          )})}

          <div className="coffee-publication-note">
            <p className="label">EDITOR&apos;S NOTE</p>
            <p>{isEnglish ? series.english.publicationNote : series.publicationNote}</p>
          </div>
          <Link className="coffee-back-link" href={routes.coffee}>
            {isEnglish ? "← View all coffee stories" : "← 모든 커피 시리즈 보기"}
          </Link>
        </article>
      </main>
      <BottomNav active="blog" />
    </>
  );
}
