import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import Link from "next/link";

// Design-system ListRow (docs/design-system.md §3) — the `.listrow v2`
// divided row used across favorites / notifications / bookings. The caller
// supplies the media slot: <ImgPh className="thumb56" /> for thumbnails or
// <span className="ic"><Icon …/></span> for icon squares.
type ListRowProps = {
  /** Renders the row (or its content when `trailing` is set) as a Link. */
  href?: string;
  /** Renders the row (or its content when `trailing` is set) as a button. */
  onClick?: MouseEventHandler;
  /** Leading slot: thumb56 image placeholder, `.ic` icon square, etc. */
  media?: ReactNode;
  title: ReactNode;
  /** Rendered before the title on the same line (e.g. <CategoryBadge/>). */
  titleAccessory?: ReactNode;
  /** Second line, `.t-caption`, single-line ellipsis. */
  caption?: ReactNode;
  /** Third line, caption-sized row (RatingLine · LiveBadge etc.). */
  meta?: ReactNode;
  /**
   * Right-side element (FavoriteButton, chevron, price…). When the row is
   * interactive, only the content becomes the link/button so an interactive
   * trailing element keeps its own tap target (favorites pattern).
   */
  trailing?: ReactNode;
  /** `.listrow v2 top` — align content to the top (multi-line rows). */
  top?: boolean;
  className?: string;
  style?: CSSProperties;
};

const ELLIPSIS: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function ListRow({
  href,
  onClick,
  media,
  title,
  titleAccessory,
  caption,
  meta,
  trailing,
  top,
  className,
  style,
}: ListRowProps) {
  const rowCls = ["listrow", "v2", top ? "top" : "", className].filter(Boolean).join(" ");
  const body = (
    <>
      {media}
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <div className="row" style={{ gap: 6, minWidth: 0 }}>
          {titleAccessory}
          <b className="t-label-md" style={{ fontSize: 14, ...ELLIPSIS }}>{title}</b>
        </div>
        {caption && <div className="t-caption" style={ELLIPSIS}>{caption}</div>}
        {meta && (
          <div className="row t-caption" style={{ gap: 6, overflow: "hidden", whiteSpace: "nowrap" }}>{meta}</div>
        )}
      </div>
    </>
  );

  if (trailing) {
    const innerStyle: CSSProperties = { gap: 12, flex: 1, minWidth: 0 };
    const inner = href ? (
      <Link href={href} className="row" style={innerStyle}>{body}</Link>
    ) : onClick ? (
      <button type="button" className="row" style={{ ...innerStyle, textAlign: "left" }} onClick={onClick}>{body}</button>
    ) : (
      <div className="row" style={innerStyle}>{body}</div>
    );
    return <div className={rowCls} style={style}>{inner}{trailing}</div>;
  }
  if (href) return <Link className={rowCls} href={href} style={style}>{body}</Link>;
  if (onClick) return <button type="button" className={rowCls} style={style} onClick={onClick}>{body}</button>;
  return <div className={rowCls} style={style}>{body}</div>;
}
