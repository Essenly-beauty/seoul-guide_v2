import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

// Design-system Button (docs/design-system.md §3).
// One primary per screen; secondary is the quiet hairline default for
// More/See-all-type actions; tonal pairs next to a primary.
export type ButtonVariant = "primary" | "secondary" | "tonal" | "danger";

type AriaProps = {
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  "aria-describedby"?: string;
  "aria-controls"?: string;
};

type ButtonProps = AriaProps & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  full?: boolean;
  icon?: IconName;
  /** Renders a Link (internal) or <a> (with `external`) instead of <button>. */
  href?: string;
  external?: boolean;
  disabled?: boolean;
  /** Native button ref for dialog focus management; ignored by link branches. */
  buttonRef?: Ref<HTMLButtonElement>;
  onClick?: MouseEventHandler;
  type?: "button" | "submit";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  icon,
  href,
  external,
  disabled,
  buttonRef,
  onClick,
  type = "button",
  className,
  style,
  children,
  ...rest
}: ButtonProps) {
  const cls = ["btn", variant, size === "sm" ? "sm" : "", full ? "full" : "", className]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {icon && <Icon name={icon} size="xs" />}
      {children}
    </>
  );

  if (href && !disabled) {
    return external ? (
      <a className={cls} style={style} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} {...rest}>
        {content}
      </a>
    ) : (
      <Link className={cls} style={style} href={href} onClick={onClick} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={buttonRef} type={type} className={cls} style={style} disabled={disabled} onClick={onClick} {...rest}>
      {content}
    </button>
  );
}
