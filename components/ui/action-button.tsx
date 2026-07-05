"use client";

import type { CSSProperties, ReactNode } from "react";
import { useToast } from "@/components/ui/toast";

type ActionButtonProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  /** Show a transient toast message. */
  toast?: string;
  /** Copy text to clipboard (+ confirmation toast). */
  copy?: string;
  /** Native share sheet, falling back to clipboard. */
  share?: string;
};

/** Generic tap target for prototype stub actions (toast / copy / share). */
export function ActionButton({ children, className, style, toast: toastMsg, copy, share, ...rest }: ActionButtonProps) {
  const { toast, copy: doCopy, share: doShare } = useToast();
  return (
    <button
      className={className}
      style={style}
      aria-label={rest["aria-label"]}
      onClick={() => {
        if (copy !== undefined) return doCopy(copy);
        if (share !== undefined) return doShare(share);
        if (toastMsg !== undefined) return toast(toastMsg);
      }}
    >
      {children}
    </button>
  );
}
