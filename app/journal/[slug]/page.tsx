import { notFound } from "next/navigation";
import Link from "next/link";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButtonBordered } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { getArticle } from "@/lib/data";

export default function JournalDetailPage({ params }: { params: { slug: string } }) {
  const a = getArticle(params.slug);
  if (!a) notFound();

  return (
    <>
      <div className="app-scroll">
        <div style={{ position: "relative" }}>
          <div className="hero-img" style={{ borderRadius: 0, aspectRatio: "16 / 10" }} />
          <div style={{ position: "absolute", top: 14, left: 14 }}>
            <BackButtonBordered fallback={routes.journal} />
          </div>
        </div>

        <div className="pad stack">
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {a.tags.map((t) => <span key={t} className="badge accent">{t}</span>)}
          </div>
          <h1 className="hero" style={{ fontSize: 28 }}>{a.title}</h1>
          <p className="caption muted mono">{a.date} · {a.readMin} min read</p>

          <p>Glass skin isn&apos;t a filter. It&apos;s hydration you can see, built one layer at a time. The Korean routine that made it famous has seven steps, but the logic is simple: clean, balance, hydrate, hold.</p>
          <h2 className="h2">1. Double cleanse</h2>
          <p className="muted">Start with an oil cleanser to dissolve SPF and makeup. Follow with a gentle foam. Residue is the enemy of the glow.</p>
          <h2 className="h2">2. Toner, essence, serum</h2>
          <p className="muted">Tap. Don&apos;t rub. Each layer is a thin film of moisture you&apos;ll seal in later. Choose hydrating toners over astringents if your skin runs dry.</p>
          <h2 className="h2">3. Moisturize + SPF</h2>
          <p className="muted">The seal. Even if you skip every other step, don&apos;t skip this. Korean SPFs are lighter and reapply-friendly.</p>

          <ActionButton className="btn ghost" share={`${a.title} | essenly.com`}>
            <Icon name="share" size="sm" /> Share this article
          </ActionButton>

          <div className="card accent stack sm">
            <b className="serif h3">Try Essenly</b>
            <p className="small muted">Free K-beauty guide + hair kit for your Seoul trip.</p>
            <Link className="btn" href={routes.splash}>Sign Up →</Link>
          </div>
        </div>
      </div>
      <BottomNav active="journal" />
    </>
  );
}
