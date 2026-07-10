import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { routes } from "@/lib/routes";
import { ARTICLES } from "@/lib/data";

export default function BlogListPage() {
  const [hero, ...rest] = ARTICLES;
  return (
    <>
      <TopBar title="Blog" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Blog</div>
          <div className="h1">K-beauty <span style={{ fontStyle: "italic", color: "var(--accent)" }}>tips &amp; stories.</span></div>
        </div>

        <Link className="bloghero" href={routes.blogArticle(hero.slug)}>
          <div className="cover hero-img" />
          <div className="body">
            <div className="tags">
              {hero.tags.slice(0, 2).map((t) => <span key={t} className="badge accent">{t}</span>)}
            </div>
            <h2>{hero.title}</h2>
            <div className="caption dim mono">{hero.date} · {hero.readMin} min read</div>
          </div>
        </Link>

        <div className="jgrid">
          {rest.map((a) => (
            <Link key={a.slug} className="jcard" href={routes.blogArticle(a.slug)}>
              <div className="cover hero-img" />
              <div className="body">
                <h4>{a.title}</h4>
                <div className="tags">
                  {a.tags.slice(0, 2).map((t) => <span key={t} className="badge dim">{t}</span>)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav active="blog" />
    </>
  );
}
