import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Notice } from "@/components/ui/notice";
import { routes } from "@/lib/routes";

type Section = { heading: string; body: string[] };

/** Editorial static page for legal copy. Server component. */
export function LegalArticle({
  title, updated, intro, sections,
}: { title: string; updated: string; intro: string; sections: Section[] }) {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.settings} />} title={title} />
      <main className="app-scroll pad stack">
        <div>
          <div className="label">Essenly Legal</div>
          <h1 className="h1">{title}</h1>
          <div className="caption dim mono" style={{ marginTop: 6 }}>Last updated · {updated}</div>
        </div>
        <Notice>Draft for review — this document has not yet been reviewed by legal counsel.</Notice>
        <p className="muted small">{intro}</p>
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="h2">{i + 1}. {s.heading}</h2>
            {s.body.map((p) => (
              <p key={p.slice(0, 24)} className="small muted" style={{ marginTop: 6 }}>{p}</p>
            ))}
          </section>
        ))}
        <p className="caption dim">Questions? Contact us via the Support page.</p>
      </main>
    </>
  );
}
