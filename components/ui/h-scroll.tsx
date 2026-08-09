import type { ReactNode } from "react";

/** Full-bleed horizontal rail — children keep their width (flex:none), no scrollbar (spec v2 §4.6-6). */
export function HScroll({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return (
    <div className="hscroll" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
