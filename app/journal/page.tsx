import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { HamburgerMenu } from "@/components/ui/hamburger-menu";
import { KitCta } from "@/components/cards";
import { routes } from "@/lib/routes";
import { ARTICLES } from "@/lib/data";

export default function JournalListPage() {
  return (
    <>
      <TopBar left={<HamburgerMenu />} title="Journal" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Journal</div>
          <div className="h1">K-beauty <span style={{ fontStyle: "italic", color: "var(--accent)" }}>tips &amp; stories.</span></div>
          <p className="muted" style={{ marginTop: 6 }}>Routines, zone guides, and Seoul beauty discoveries.</p>
        </div>

        <KitCta
          href={routes.splash}
          title="Sign up and get a free K-beauty hair kit"
          subtitle="Personalized routine + pickup in Seoul."
          trailing={<span className="badge accent" style={{ marginLeft: "auto" }}>Sign Up →</span>}
        />

        <div className="jgrid">
          {ARTICLES.map((a) => (
            <Link key={a.slug} className="jcard" href={routes.journalArticle(a.slug)}>
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
