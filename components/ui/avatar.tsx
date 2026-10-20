import type { CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

// Design-system Avatar (docs/design-system.md §3) — initial-letter circle
// (accent-soft bg, accent text) from the menu profile header; falls back to
// the user glyph when no name is known (map-screen avatar entry point).
type AvatarProps = {
  /** First letter becomes the initial; omit for the user-glyph fallback. */
  name?: string;
  /** Diameter in px. Default 30 (review-row size from CSS). */
  size?: number;
  /** Renders a Link (e.g. to My page) instead of a static circle. */
  href?: string;
  title?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
};

export function Avatar({ name, size, href, title, 'aria-label': ariaLabel, 'aria-hidden': ariaHidden }: AvatarProps) {
  const style: CSSProperties | undefined = size
    ? { width: size, height: size, fontSize: Math.round(size * 0.35) }
    : undefined;
  const content = name ? name.trim().charAt(0).toUpperCase() : <Icon name="user" size="sm" />;
  if (href) {
    return (
      <Link className="avatar" style={style} href={href} title={title} aria-hidden={ariaHidden} aria-label={ariaLabel ?? (name ? `${name} — profile` : "Profile")}>
        {content}
      </Link>
    );
  }
  return <span className="avatar" style={style} title={title} aria-hidden={ariaHidden} aria-label={ariaLabel}>{content}</span>;
}
