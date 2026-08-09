"use client";

import { useEffect, useRef, useState } from "react";

export type AnchorSection = { id: string; label: string };

/** Sticky in-page section tabs with scroll-spy (spec v2 §4.6-3, §4.7).
    Tabs scroll to `#id` anchors; the active tab follows the top-most visible section. */
export function AnchorTabs({ sections, offset = 100 }: {
  sections: AnchorSection[];
  /** Height (px) covered by sticky chrome above the content — used by the spy rootMargin. */
  offset?: number;
}) {
  const [active, setActive] = useState(sections[0]?.id);
  // Suppress spy updates briefly while a click-initiated smooth scroll is in flight,
  // so intermediate sections don't flash active.
  const clickLock = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (clickLock.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: `-${offset}px 0px -55% 0px` },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, offset]);

  useEffect(() => () => { if (clickLock.current) clearTimeout(clickLock.current); }, []);

  const go = (id: string) => {
    setActive(id);
    if (clickLock.current) clearTimeout(clickLock.current);
    clickLock.current = setTimeout(() => { clickLock.current = null; }, 700);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav className="anchortabs" aria-label="Page sections">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-current={active === s.id ? "location" : undefined}
          className={active === s.id ? "on" : ""}
          onClick={() => go(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
