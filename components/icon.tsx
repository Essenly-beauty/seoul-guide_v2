import type { CSSProperties } from "react";

export type IconName =
  | "home"
  | "menu"
  | "more"
  | "down"
  | "heart"
  | "heart-o"
  | "book"
  | "user"
  | "back"
  | "chev"
  | "share"
  | "gift"
  | "plane"
  | "bag"
  | "scissors"
  | "spa"
  | "cross"
  | "pin"
  | "copy"
  | "car"
  | "ig"
  | "check"
  | "x"
  | "plus"
  | "minus"
  | "cal"
  | "call"
  | "bell"
  | "ext"
  | "lock"
  | "door"
  | "mark"
  | "search"
  | "locate"
  | "swap"
  | "train";

type IconProps = {
  name: IconName;
  size?: "sm" | "xs";
  className?: string;
  style?: CSSProperties;
};

/** Renders an icon from the sprite injected once by <IconSprite /> in the root layout. */
export function Icon({ name, size, className = "", style }: IconProps) {
  const cls = ["icn", size ?? "", className].filter(Boolean).join(" ");
  return (
    <svg className={cls} style={style} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

/**
 * Hidden SVG symbol definitions. Mount once at the top of the app.
 *
 * Glyphs are copied from lucide-static v1.26 (ISC) so the same sprite serves
 * both React call sites (<Icon />) and raw-HTML consumers (Leaflet divIcon
 * strings in components/map/map-view.tsx and components/subway/*), which
 * reference symbols as `<use href="#i-…"/>`. Lucide icons are stroke-based:
 * each symbol carries fill="none" stroke="currentColor"; `heart` is the one
 * filled variant (fill="currentColor"). stroke-width deliberately lives in
 * CSS (`.icn { stroke-width: 2 }` in globals.css) rather than on the symbols,
 * so tiny contexts (.catbadge/.pin-badge) can bump it — a presentation
 * attribute on the symbol would override the inherited CSS value inside the
 * <use> shadow tree.
 */
export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      {/* lucide: house */}
      <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </symbol>
      {/* lucide: menu */}
      <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </symbol>
      {/* lucide: ellipsis-vertical */}
      <symbol id="i-more" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </symbol>
      {/* lucide: chevron-down */}
      <symbol id="i-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </symbol>
      {/* lucide: heart (filled) */}
      <symbol id="i-heart" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
      </symbol>
      {/* lucide: heart */}
      <symbol id="i-heart-o" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
      </symbol>
      {/* lucide: book-open */}
      <symbol id="i-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v16" />
        <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
      </symbol>
      {/* lucide: circle-user-round */}
      <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.925 20.056a6 6 0 0 0-11.851.001" />
        <circle cx="12" cy="11" r="4" />
        <circle cx="12" cy="12" r="10" />
      </symbol>
      {/* lucide: chevron-left */}
      <symbol id="i-back" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </symbol>
      {/* lucide: chevron-right */}
      <symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </symbol>
      {/* lucide: share-2 */}
      <symbol id="i-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
        <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
      </symbol>
      {/* lucide: gift */}
      <symbol id="i-gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 7v14" />
        <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
        <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" />
        <rect x="3" y="7" width="18" height="4" rx="1" />
      </symbol>
      {/* lucide: plane */}
      <symbol id="i-plane" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </symbol>
      {/* lucide: shopping-bag */}
      <symbol id="i-bag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 10a4 4 0 0 1-8 0" />
        <path d="M3.103 6.034h17.794" />
        <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
      </symbol>
      {/* lucide: scissors */}
      <symbol id="i-scissors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" />
        <path d="M8.12 8.12 12 12" />
        <path d="M20 4 8.12 15.88" />
        <circle cx="6" cy="18" r="3" />
        <path d="M14.8 14.8 20 20" />
      </symbol>
      {/* lucide: flower-2 */}
      <symbol id="i-spa" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1" />
        <circle cx="12" cy="8" r="2" />
        <path d="M12 10v12" />
        <path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z" />
        <path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z" />
      </symbol>
      {/* lucide: cross */}
      <symbol id="i-cross" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z" />
      </symbol>
      {/* lucide: map-pin */}
      <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </symbol>
      {/* lucide: copy */}
      <symbol id="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </symbol>
      {/* lucide: car-taxi-front */}
      <symbol id="i-car" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2h4" />
        <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" />
        <path d="M7 14h.01" />
        <path d="M17 14h.01" />
        <rect width="18" height="8" x="3" y="10" rx="2" />
        <path d="M5 18v2" />
        <path d="M19 18v2" />
      </symbol>
      {/* instagram — lucide dropped brand icons; classic lucide instagram glyph kept in lucide stroke style */}
      <symbol id="i-ig" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </symbol>
      {/* lucide: check */}
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </symbol>
      {/* lucide: x */}
      <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </symbol>
      {/* lucide: plus */}
      <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </symbol>
      {/* lucide: minus */}
      <symbol id="i-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
      </symbol>
      {/* lucide: calendar */}
      <symbol id="i-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
      </symbol>
      {/* lucide: phone */}
      <symbol id="i-call" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
      </symbol>
      {/* lucide: bell */}
      <symbol id="i-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
      </symbol>
      {/* lucide: arrow-up-right */}
      <symbol id="i-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
      </symbol>
      {/* lucide: lock */}
      <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </symbol>
      {/* lucide: log-out */}
      <symbol id="i-door" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      </symbol>
      {/* lucide: palette */}
      <symbol id="i-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      </symbol>
      {/* lucide: search */}
      <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 21-4.34-4.34" />
        <circle cx="11" cy="11" r="8" />
      </symbol>
      {/* lucide: locate-fixed */}
      <symbol id="i-locate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" x2="5" y1="12" y2="12" />
        <line x1="19" x2="22" y1="12" y2="12" />
        <line x1="12" x2="12" y1="2" y2="5" />
        <line x1="12" x2="12" y1="19" y2="22" />
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
      </symbol>
      {/* lucide: arrow-down-up */}
      <symbol id="i-swap" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 16 4 4 4-4" />
        <path d="M7 20V4" />
        <path d="m21 8-4-4-4 4" />
        <path d="M17 4v16" />
      </symbol>
      {/* lucide: train-front */}
      <symbol id="i-train" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1" />
        <path d="m9 15-1-1" />
        <path d="m15 15 1-1" />
        <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z" />
        <path d="m8 19-2 3" />
        <path d="m16 19 2 3" />
      </symbol>
      {/* Brand leaf — NOT lucide; the product's own mark. currentColor so the
          glyph inherits (BrandMark supplies its own green). Kept separate from
          i-mark, which is now the lucide palette used for the personal-color
          category. */}
      <symbol id="i-mark-brand" viewBox="0 0 40 40">
        <path d="M20 4c-9 0-16 6.5-16 16 0 3 1 5.6 2.8 7.6C9 22 14 18 20.5 18c-4 2-7 5.5-8.4 10.4C14 30.6 16.8 32 20 32c9 0 16-6.5 16-16S29 4 20 4z" fill="currentColor" />
        <circle cx="27" cy="26" r="3.2" fill="currentColor" />
      </symbol>
    </svg>
  );
}

/** The brand mark, sized independently of the icon utility classes. */
export function BrandMark({ size = 24, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} style={{ color: "var(--accent)", ...style }} aria-hidden="true">
      <use href="#i-mark-brand" />
    </svg>
  );
}
