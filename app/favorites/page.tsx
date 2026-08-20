"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ImgPh } from "@/components/ui/img-ph";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { LiveBadge } from "@/components/ui/live-badge";
import { RatingLine } from "@/components/ui/rating-line";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { CategoryBadge } from "@/components/category/category-badge";
import { CategoryChips } from "@/components/category/category-chips";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { ARTICLES, PLACES, PRODUCTS, TYPE_LABEL, zoneShort, type Article, type Place, type Product } from "@/lib/data";
import { useFavorites, useFavoritesReady } from "@/lib/favorites";
import { useAuthUser } from "@/lib/auth/use-auth";
import { useSigninNudge } from "@/components/auth/signin-nudge";
import { useToast } from "@/components/ui/toast";
import { createSharedList, LIST_TITLE_MAX, sanitizeListTitle, sharedListUrl } from "@/lib/shared-lists";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

// Pulsing placeholder rows while the account's saved list is fetched —
// flashing "nothing saved yet" on a fresh device reads as data loss.
function LoadingRows() {
  const bar = { borderRadius: 6, background: "var(--surface-hover)", border: "1px solid var(--border)" };
  return (
    <div
      className="stack sm"
      role="status"
      aria-busy="true"
      aria-label="Loading saved items"
      style={{ animation: "pulse 1.6s ease-in-out infinite" }}
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="row" style={{ gap: 12, padding: "10px 0" }}>
          <div style={{ ...bar, width: 56, height: 56, flex: "none", borderRadius: 12 }} />
          <div className="stack" style={{ flex: 1, gap: 7 }}>
            <div style={{ ...bar, width: `${62 - i * 12}%`, height: 14 }} />
            <div style={{ ...bar, width: `${40 - i * 6}%`, height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Share the saved-places list as a /map?list= link ──────
// (user request 2026-08-16 — Kakao/Naver shared-folder pattern.)
// Members name the snapshot before it becomes a link (v1.1: the auto
// title was the only option); guests get the join sheet.
function ShareListButton({ placeIds }: { placeIds: string[] }) {
  const { user } = useAuthUser();
  const { nudge, sheet } = useSigninNudge();
  const { toast, share } = useToast();
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const shareNow = async () => {
    setBusy(true);
    try {
      const finalTitle = sanitizeListTitle(title);
      const id = await createSharedList(finalTitle, placeIds);
      setNaming(false);
      share({ title: finalTitle, text: "My saved places on MYSEOULDROP. No app install needed — open on the web and save the places to your own list:", url: sharedListUrl(window.location.origin, id) });
    } catch (e) {
      toast(e instanceof Error && e.message === "Nothing to share yet" ? e.message : "Couldn't create the share link — try again");
    } finally {
      setBusy(false);
    }
  };

  if (naming) {
    return (
      <div className="stack sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px" }}>
        <label className="caption muted" htmlFor="share-list-name">Name your list — friends see this title on the link</label>
        <input
          id="share-list-name"
          className="input"
          maxLength={LIST_TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) void shareNow(); }}
          autoFocus
        />
        <div className="row" style={{ gap: 8 }}>
          <Button variant="secondary" size="sm" style={{ flex: 1 }} disabled={busy} onClick={() => setNaming(false)}>Cancel</Button>
          <Button size="sm" style={{ flex: 1 }} disabled={busy} onClick={() => void shareNow()}>Share link</Button>
        </div>
        <p className="t-caption">No app install needed. Friends can open the web link and save every place to their own list.</p>
      </div>
    );
  }

  return (
    <>
      {sheet}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          if (!user) {
            nudge("shareList");
            return;
          }
          const fullName = (user.user_metadata as { full_name?: string } | null)?.full_name;
          setTitle(sanitizeListTitle(fullName ? `${fullName}'s Seoul list` : null));
          setNaming(true);
        }}
      >
        <Icon name="share" size="xs" /> Share this list
      </Button>
    </>
  );
}

// ── Places — category filter + detail-page list rows ──────
function PlacesSection({ favPlaces }: { favPlaces: Place[] }) {
  const [cats, setCats] = useState<Place["type"][]>([]);
  const shown = cats.length === 0 ? favPlaces : favPlaces.filter((p) => cats.includes(p.type));
  return (
    <section className="stack sm">
      <SectionHeader title="Places" count={favPlaces.length} actionLabel="See all" href={routes.savedPlacesMap} />
      <CategoryChips
        selected={cats}
        onToggle={(key) => setCats((cur) => cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key])}
        onClear={() => setCats([])}
      />
      {shown.length === 0 ? (
        <EmptyState>{favPlaces.length === 0 ? "Nothing saved yet — tap ♥ on any place." : "No saved places in this category."}</EmptyState>
      ) : (
        <div>
          {shown.map((p) => (
            <ListRow
              key={p.id}
              href={routes.place(p.id)}
              media={<ImgPh className="thumb56" />}
              title={p.name}
              titleAccessory={<CategoryBadge type={p.type} size={16} />}
              caption={<>{TYPE_LABEL[p.type]} · {zoneShort(p.zone)} · {p.priceRange}</>}
              meta={(
                <>
                  <RatingLine rating={p.rating} count={p.ratingCount} plain />
                  <span aria-hidden="true">·</span>
                  <LiveBadge hours={p.hours} showUntil={false} />
                </>
              )}
              trailing={<FavoriteButton kind="place" id={p.id} variant="soft" size="xs" />}
            />
          ))}
        </div>
      )}
      {favPlaces.length > 0 && <ShareListButton placeIds={favPlaces.map((p) => p.id)} />}
    </section>
  );
}

// ── Products — same row language as Ranking ────────────────
function ProductsSection({ favProducts }: { favProducts: Product[] }) {
  return (
    <section className="stack sm">
      <SectionHeader title="Products" count={favProducts.length} actionLabel="See all" href={routes.ranking} />
      {favProducts.length === 0 && <EmptyState>No saved products yet.</EmptyState>}
      <div>
        {favProducts.map((prod) => (
          <div className="listrow v2" key={prod.id}>
            <Link href={routes.shopItem(prod.id)} className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
              <ImgPh className="thumb56" />
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.name}</b>
                <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {prod.brand} · {prod.nameKr}
                </div>
              </div>
              {prod.priceRange && <span className="mono num t-label-md" style={{ fontWeight: 700, flex: "none" }}>{prod.priceRange}</span>}
            </Link>
            <FavoriteButton kind="product" id={prod.id} variant="soft" size="xs" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Blog — icon-led rows ───────────────────────────────────
function ArticlesSection({ favArticles }: { favArticles: Article[] }) {
  return (
    <section className="stack sm">
      <SectionHeader title="Blog" count={favArticles.length} actionLabel="See all" href={routes.blog} />
      {favArticles.length === 0 && <EmptyState>No saved stories yet.</EmptyState>}
      <div>
        {favArticles.map((a) => (
          <div className="listrow" key={a.slug}>
            <Link href={routes.blogArticle(a.slug)} className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
              <span className="ic"><Icon name="book" size="sm" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</b>
                <div className="caption muted">{a.date} · {a.readMin} min read</div>
              </div>
            </Link>
            <FavoriteButton kind="article" id={a.slug} variant="soft" size="xs" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FavoritesPage() {
  // Live store — rows appear/disappear as hearts toggle anywhere in the app.
  const favs = useFavorites();
  const ready = useFavoritesReady();
  const { user, loading: authLoading } = useAuthUser();
  const favPlaces = PLACES.filter((p) => favs.place.includes(p.id));
  const favProducts = PRODUCTS.filter((p) => favs.product.includes(p.id));
  const favArticles = ARTICLES.filter((a) => favs.article.includes(a.slug));
  return (
    <>
      <TopBar center title="Saved" />
      <div className="app-scroll pad stack pagev2">
        <div>
          <div className="label">Saved</div>
          <div className="h1">Your <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty list.</span></div>
        </div>
        {/* guest -> account funnel: saves live on this device only until sign-in */}
        {ready && !authLoading && !user && (
          <Notice icon="user">
            <span className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180 }}>Saved on this device — sign in to keep your list on your account.</span>
              <Button size="sm" href={`${routes.signIn}?next=/favorites`} style={{ flex: "none" }}>Sign in</Button>
            </span>
          </Notice>
        )}
        {ready ? (
          <>
            <PlacesSection favPlaces={favPlaces} />
            <SectionDivider />
            <ProductsSection favProducts={favProducts} />
            <SectionDivider />
            <ArticlesSection favArticles={favArticles} />
          </>
        ) : (
          <LoadingRows />
        )}
      </div>
      <BottomNav active="saved" />
    </>
  );
}
