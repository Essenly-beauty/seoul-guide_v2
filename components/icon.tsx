import type { CSSProperties } from "react";

export type IconName =
  | "home"
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
  | "bell"
  | "ext"
  | "lock"
  | "door"
  | "mark"
  | "search"
  | "locate";

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

/** Hidden SVG symbol definitions. Mount once at the top of the app. */
export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      <symbol id="i-home" viewBox="0 0 24 24">
        <path d="M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </symbol>
      <symbol id="i-heart" viewBox="0 0 24 24">
        <path d="M12 21S3.5 14.6 3.5 8.9A4.4 4.4 0 0 1 12 6.5a4.4 4.4 0 0 1 8.5 2.4C20.5 14.6 12 21 12 21z" />
      </symbol>
      <symbol id="i-heart-o" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20S4 14 4 8.8A4 4 0 0 1 12 6.6 4 4 0 0 1 20 8.8C20 14 12 20 12 20z" />
      </symbol>
      <symbol id="i-book" viewBox="0 0 24 24">
        <path d="M5 3h11a3 3 0 0 1 3 3v15l-6-3-6 3V6a3 3 0 0 0-3-3z" opacity=".25" />
        <path d="M4 4h12a2 2 0 0 1 2 2v15l-5.5-2.7L7 21V6a2 2 0 0 0-2-2z" />
      </symbol>
      <symbol id="i-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4.2" />
        <path d="M4 21a8 8 0 0 1 16 0z" />
      </symbol>
      <symbol id="i-back" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </symbol>
      <symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5l7 7-7 7" />
      </symbol>
      <symbol id="i-share" viewBox="0 0 24 24">
        <path d="M18 8a3 3 0 1 0-2.8-4L8.9 7.6a3 3 0 1 0 0 8.8l6.3 3.6A3 3 0 1 0 18 16a3 3 0 0 0-2 .8l-6.2-3.6a3 3 0 0 0 0-2.4L16 7.2A3 3 0 0 0 18 8z" />
      </symbol>
      <symbol id="i-gift" viewBox="0 0 24 24">
        <path d="M20 9v11a1 1 0 0 1-1 1h-6V9zM11 9v12H5a1 1 0 0 1-1-1V9zM21 5v3H3V5a1 1 0 0 1 1-1h4.2A2.6 2.6 0 0 1 12 3a2.6 2.6 0 0 1 3.8 1H20a1 1 0 0 1 1 1z" />
      </symbol>
      <symbol id="i-plane" viewBox="0 0 24 24">
        <path d="M21 15v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5z" />
      </symbol>
      <symbol id="i-bag" viewBox="0 0 24 24">
        <path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      </symbol>
      <symbol id="i-scissors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="M8 8l12 10M8 16L20 6" />
      </symbol>
      <symbol id="i-spa" viewBox="0 0 24 24">
        <path d="M12 3c2 3 2 6 0 8-2-2-2-5 0-8zM5 9c3 0 5 2 6 5-3 .5-5-1-6-5zM19 9c-1 4-3 5.5-6 5 1-3 3-5 6-5zM4 20a8 8 0 0 1 16 0z" />
      </symbol>
      <symbol id="i-cross" viewBox="0 0 24 24">
        <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
      </symbol>
      <symbol id="i-pin" viewBox="0 0 24 24">
        <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
      </symbol>
      <symbol id="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h8" />
      </symbol>
      <symbol id="i-car" viewBox="0 0 24 24">
        <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2v2h-2v-2H7v2H5v-2H3v-5a1 1 0 0 1 1-1zm2.2 0h9.6l-1-3H8.2zM6.5 15.5A1.5 1.5 0 1 0 6.5 12.5a1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      </symbol>
      <symbol id="i-ig" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 6.5" />
      </symbol>
      <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </symbol>
      <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="i-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M5 12h14" />
      </symbol>
      <symbol id="i-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M4 9h16M9 3v4M15 3v4" />
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24">
        <path d="M12 2a6 6 0 0 0-6 6c0 6-2 7-2 7h16s-2-1-2-7a6 6 0 0 0-6-6zM10 20a2 2 0 0 0 4 0z" />
      </symbol>
      <symbol id="i-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h10v10M18 6 6 18" />
      </symbol>
      <symbol id="i-lock" viewBox="0 0 24 24">
        <path d="M6 10V8a6 6 0 0 1 12 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h8V8a4 4 0 0 0-8 0z" />
      </symbol>
      <symbol id="i-door" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8" />
        <path d="M11 12h9M17 8l4 4-4 4" />
      </symbol>
      <symbol id="i-locate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
      </symbol>
      <symbol id="i-mark" viewBox="0 0 40 40">
        <path d="M20 4c-9 0-16 6.5-16 16 0 3 1 5.6 2.8 7.6C9 22 14 18 20.5 18c-4 2-7 5.5-8.4 10.4C14 30.6 16.8 32 20 32c9 0 16-6.5 16-16S29 4 20 4z" fill="#0C8E70" />
        <circle cx="27" cy="26" r="3.2" fill="#0C8E70" />
      </symbol>
    </svg>
  );
}

/** The brand mark, sized independently of the icon utility classes. */
export function BrandMark({ size = 24, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} style={style} aria-hidden="true">
      <use href="#i-mark" />
    </svg>
  );
}
