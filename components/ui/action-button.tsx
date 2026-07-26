"use client";

import type { CSSProperties, ReactNode } from "react";
import type { IconName } from "@/components/icon";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { IconButton, type IconButtonVariant } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";

type ActionEffects = {
  className?: string;
  style?: CSSProperties;
  /** Show a transient toast message. */
  toast?: string;
  /** Copy text to clipboard (+ confirmation toast). */
  copy?: string;
  /** Native share sheet, falling back to clipboard. */
  share?: string;
};

type ActionButtonProps = ActionEffects & (
  | {
      children: ReactNode;
      /** Use the core Button when the action has standard button presentation. */
      variant?: ButtonVariant;
      size?: "md" | "sm";
      full?: boolean;
      iconAction?: never;
      "aria-label"?: string;
    }
  | {
      children?: never;
      variant?: never;
      size?: never;
      full?: never;
      /** Standard icon-only presentation with a required accessible name. */
      iconAction: {
        name: IconName;
        label: string;
        variant?: IconButtonVariant;
      };
      "aria-label"?: never;
    }
);

/** Generic tap target for prototype stub actions (toast / copy / share). */
export function ActionButton({
  children,
  className,
  style,
  variant,
  size,
  full,
  iconAction,
  toast: toastMsg,
  copy,
  share,
  ...rest
}: ActionButtonProps) {
  const { toast, copy: doCopy, share: doShare } = useToast();
  const handleClick = () => {
    if (copy !== undefined) return doCopy(copy);
    if (share !== undefined) return doShare(share);
    if (toastMsg !== undefined) return toast(toastMsg);
  };

  if (iconAction) {
    return (
      <IconButton
        name={iconAction.name}
        label={iconAction.label}
        variant={iconAction.variant}
        className={className}
        style={style}
        onClick={handleClick}
      />
    );
  }

  if (variant) {
    return (
      <Button
        variant={variant}
        size={size}
        full={full}
        className={className}
        style={style}
        aria-label={rest["aria-label"]}
        onClick={handleClick}
      >
        {children}
      </Button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={rest["aria-label"]}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
