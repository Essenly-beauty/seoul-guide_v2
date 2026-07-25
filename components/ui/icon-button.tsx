import type { CSSProperties, MouseEventHandler } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

// Design-system IconButton (docs/design-system.md §3).
// plain: transparent, inside rows · soft: brand-soft circle, CTA bars ·
// overlay: white + hairline, floating over photos/maps.
type IconButtonProps = {
  name: IconName;
  /** Required — icon-only controls must announce themselves. */
  label: string;
  variant?: "plain" | "soft" | "overlay";
  size?: number;
  iconSize?: "sm" | "xs";
  pressed?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler;
  /** Renders a Link (internal) or <a> (with `external`) instead of <button>. */
  href?: string;
  external?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function IconButton({
  name,
  label,
  variant = "plain",
  size,
  iconSize = "sm",
  pressed,
  disabled,
  onClick,
  href,
  external,
  className,
  style,
}: IconButtonProps) {
  const cls = ["iconbtn", variant === "plain" ? "" : variant, className].filter(Boolean).join(" ");
  const sizing = size ? { width: size, height: size, ...style } : style;
  const glyph = <Icon name={name} size={iconSize} />;
  if (href && !disabled) {
    return external ? (
      <a className={cls} style={sizing} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
        {glyph}
      </a>
    ) : (
      <Link className={cls} style={sizing} href={href} aria-label={label} title={label}>
        {glyph}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      style={sizing}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}
