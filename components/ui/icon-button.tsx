import type { AriaAttributes, CSSProperties, MouseEventHandler, Ref } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

// Design-system IconButton (docs/design-system.md §3).
// plain: transparent, inside rows · soft: brand-soft circle, CTA bars ·
// overlay: white + hairline, floating over photos/maps.
export type IconButtonVariant = "plain" | "soft" | "overlay";

type IconButtonProps = {
  name: IconName;
  /** Required — icon-only controls must announce themselves. */
  label: string;
  variant?: IconButtonVariant;
  size?: number;
  iconSize?: "md" | "sm" | "xs";
  pressed?: boolean;
  disabled?: boolean;
  /** Native button ref for dialog focus management; ignored by link branches. */
  buttonRef?: Ref<HTMLButtonElement>;
  onClick?: MouseEventHandler;
  /** Renders a Link (internal) or <a> (with `external`) instead of <button>. */
  href?: string;
  external?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: AriaAttributes["aria-haspopup"];
  "aria-describedby"?: string;
};

export function IconButton({
  name,
  label,
  variant = "plain",
  size,
  iconSize = "sm",
  pressed,
  disabled,
  buttonRef,
  onClick,
  href,
  external,
  className,
  style,
  ...rest
}: IconButtonProps) {
  const cls = ["iconbtn", variant === "plain" ? "" : variant, className].filter(Boolean).join(" ");
  const sizing = size ? { width: size, height: size, ...style } : style;
  const glyph = <Icon name={name} size={iconSize === "md" ? undefined : iconSize} />;
  if (href && !disabled) {
    return external ? (
      <a className={cls} style={sizing} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} onClick={onClick} {...rest}>
        {glyph}
      </a>
    ) : (
      <Link className={cls} style={sizing} href={href} aria-label={label} title={label} onClick={onClick} {...rest}>
        {glyph}
      </Link>
    );
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      className={cls}
      style={sizing}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {glyph}
    </button>
  );
}
