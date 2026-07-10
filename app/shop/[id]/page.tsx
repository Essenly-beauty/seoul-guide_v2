import { notFound } from "next/navigation";
import Link from "next/link";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Icon } from "@/components/icon";
import { KitCta } from "@/components/cards";
import { routes } from "@/lib/routes";
import { getProduct, STEP_LABEL, CHANNEL_LABEL, zoneShort } from "@/lib/data";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const p = getProduct(params.id);
  if (!p) notFound();

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const matchBits = [p.skinTypes[0]?.toLowerCase() && `${p.skinTypes[0].toLowerCase()} skin`, p.concerns[0]?.toLowerCase()].filter(Boolean);
  const partnerStore = { name: "Olive Young Myeongdong", nameKr: "올리브영 명동", type: "Flagship · Jung-gu" };

  return (
    <>
      <div className="topbar">
        <BackButton fallback={routes.shop} />
        <span style={{ flex: 1 }} />
        <FavoriteButton initial={p.isEditorsPick} />
      </div>

      <div className="app-scroll">
        <div style={{ position: "relative" }}>
          <div className="hero-img tall" style={{ borderRadius: 0, aspectRatio: "4 / 3" }}>
            <Icon name="bag" style={{ width: 52, height: 52, color: "var(--accent)" }} />
          </div>
        </div>

        <div className="pad stack">
          <div className="chipwrap">
            {p.isEditorsPick && <span className="badge accent"><Icon name="check" size="xs" />Editor&apos;s Pick</span>}
            {p.isTrending && <span className="badge warning">Trending</span>}
            {p.stepCategory && <span className="badge info">{STEP_LABEL[p.stepCategory]}</span>}
          </div>

          <div>
            <div className="label">{p.brand.toUpperCase()}</div>
            <h1 className="h1">{p.name}</h1>
            <p className="caption muted mono" style={{ marginTop: 4 }}>{CHANNEL_LABEL[p.channel]}</p>
          </div>

          <div className="card accent">
            <div className="row between">
              <div>
                <div className="mono" style={{ fontSize: 13 }}>{p.nameKr}</div>
                <div className="caption muted" style={{ marginTop: 2 }}>Show this name to store staff.</div>
              </div>
              <ActionButton className="btn sm outline" copy={p.nameKr}><Icon name="copy" size="xs" />Copy</ActionButton>
            </div>
          </div>

          {matchBits.length > 0 && (
            <div className="banner accent">
              <Icon name="check" size="sm" />
              <span><i>Matches your {matchBits.join(" + ")} concerns.</i></span>
            </div>
          )}

          <div className="stack sm">
            <div className="kv"><span className="k">Brand</span><Link className="v" href={routes.brand(p.brand.toLowerCase().replace(/\s+/g, "-"))} style={{ color: "var(--accent)", fontFamily: "var(--sans)" }}>{p.brand} →</Link></div>
            <div className="kv"><span className="k">Category</span><span className="v" style={{ fontFamily: "var(--sans)" }}>{cap(p.category)}{p.stepCategory ? ` · ${STEP_LABEL[p.stepCategory]}` : ""}</span></div>
            <div className="kv"><span className="k">Channel</span><span className="v" style={{ fontFamily: "var(--sans)" }}>{CHANNEL_LABEL[p.channel]}</span></div>
            {p.priceRange && <div className="kv"><span className="k">Price</span><span className="v">{p.priceRange}</span></div>}
            {p.skinTypes.length > 0 && <div className="kv"><span className="k">Best for</span><span className="v" style={{ fontFamily: "var(--sans)" }}>{p.skinTypes.join(", ")}</span></div>}
            {p.concerns.length > 0 && <div className="kv"><span className="k">Targets</span><span className="v" style={{ fontFamily: "var(--sans)" }}>{p.concerns.join(", ")}</span></div>}
          </div>

          <div>
            <h2 className="h2">Where to buy in Seoul</h2>
            {p.zoneAvailability && p.zoneAvailability.length > 0 && (
              <>
                <div className="label" style={{ marginTop: 10 }}>Available in</div>
                <div className="chipwrap" style={{ marginTop: 6 }}>
                  {p.zoneAvailability.map((z) => <span key={z} className="chip soft selected">{zoneShort(z)}</span>)}
                </div>
              </>
            )}
            <div className="label" style={{ marginTop: 12 }}>Buy online</div>
            <ActionButton className="btn ghost" style={{ marginTop: 6 }} toast="Opening store page…">Buy online <Icon name="ext" size="xs" /></ActionButton>

            <div className="label" style={{ marginTop: 12 }}>Partner stores</div>
            <div className="card stack sm" style={{ marginTop: 6 }}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div><b>{partnerStore.name}</b><div className="caption muted">{partnerStore.type}</div></div>
                <ActionButton className="btn ghost sm" copy={partnerStore.nameKr} aria-label="Copy Korean name"><Icon name="copy" size="xs" />Copy</ActionButton>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", opacity: 0.6, margin: "2px 0" }} />
              <div className="linkgrid">
                <ActionButton className="linkbtn" toast="Opening Kakao Map…"><Icon name="pin" size="sm" />Kakao</ActionButton>
                <ActionButton className="linkbtn" toast="Opening Google Maps…"><Icon name="pin" size="sm" />Google</ActionButton>
                <ActionButton className="linkbtn" toast="Opening Naver Map…"><Icon name="pin" size="sm" />Naver</ActionButton>
              </div>
            </div>
          </div>

          <Link className="card tap row between" href={routes.routine}>
            <span><b>See it in your routine</b><div className="caption muted">Curated K-beauty steps for you</div></span>
            <Icon name="chev" size="sm" style={{ color: "var(--dim)" }} />
          </Link>

          <KitCta href={routes.kitSurvey} title="Try this with a free Essenly kit" subtitle="Hair pack + routine card, picked up in Seoul." />
        </div>
      </div>
      <BottomNav active="ranking" />
    </>
  );
}
