"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ProductShareButton } from "@/components/product/product-share-button";
import { BackButton, BackButtonBordered } from "@/components/ui/back-button";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";

type ShareProduct = { id: string; brand: string; name: string };

export function headerProgress({
  top,
  height,
  safeTop,
}: {
  top: number;
  height: number;
  safeTop: number;
}): number {
  if (height <= 0) return top < safeTop ? 1 : 0;
  return Math.max(0, Math.min(1, (safeTop - top) / height));
}

export function ProductDetailScrollHeader({
  title,
  product,
  fallback,
  rankingHref,
  children,
}: {
  title: string;
  product: ShareProduct;
  fallback: string;
  rankingHref: string;
  children: ReactNode;
}) {
  const actionRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { copy } = useToast();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(media.matches);
    updateMotionPreference();
    media.addEventListener("change", updateMotionPreference);
    return () => media.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const action = actionRef.current;
    const scroller = action?.closest<HTMLElement>(".app-scroll");
    if (!action || !scroller) return;

    const measure = () => {
      frameRef.current = null;
      const actionRect = action.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const next = headerProgress({
        top: actionRect.top - scrollerRect.top,
        height: actionRect.height || 44,
        safeTop: 0,
      });
      setProgress((current) => Math.abs(current - next) > 0.005 ? next : current);
    };
    const scheduleMeasure = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(measure);
    };

    measure();
    scroller.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      scroller.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const focusFrame = requestAnimationFrame(() => menuItemRefs.current[0]?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      requestAnimationFrame(() => menuTriggerRef.current?.focus());
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Begin the handoff only once half of the hero action row has crossed the
  // safe top, then complete it over the remaining half of that row.
  const revealProgress = Math.max(0, Math.min(1, (progress - 0.5) * 2));
  const displayProgress = prefersReducedMotion ? (progress >= 0.5 ? 1 : 0) : revealProgress;
  const compactVisible = displayProgress > 0;
  const closeMenuAndRestoreFocus = () => {
    setMenuOpen(false);
    requestAnimationFrame(() => menuTriggerRef.current?.focus());
  };
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuItemRefs.current.filter((item): item is HTMLElement => Boolean(item));
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = current < items.length - 1 ? current + 1 : 0;
    if (event.key === "ArrowUp") next = current > 0 ? current - 1 : items.length - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndRestoreFocus();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <>
      <div className={`detail-compactwrap product-detail-progress-wrap${compactVisible ? " on" : ""}`}>
        <div
          className="detail-compactbar product-detail-compactbar product-detail-progress-bar"
          style={{ opacity: displayProgress, transform: `translateY(${(1 - displayProgress) * -8}px)` }}
          aria-hidden={!compactVisible}
          inert={!compactVisible ? true : undefined}
        >
          <div className="product-detail-compact-leading">
            <BackButton fallback={fallback} />
          </div>
          <b className="product-detail-compact-title">{title}</b>
          <div className="product-detail-compact-actions">
            <ProductShareButton aria-label="Share product" product={product} />
            <div ref={menuRef} className="product-detail-overflow">
              <IconButton
                buttonRef={menuTriggerRef}
                name="more"
                label="More product actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              />
              {menuOpen && (
                <div className="detail-menucard" role="menu" aria-label="Product actions" onKeyDown={onMenuKeyDown}>
                  <button
                    ref={(node) => { menuItemRefs.current[0] = node; }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => { copy(window.location.href); closeMenuAndRestoreFocus(); }}
                  >
                    Copy link
                  </button>
                  <Link
                    ref={(node) => { menuItemRefs.current[1] = node; }}
                    role="menuitem"
                    tabIndex={-1}
                    href={rankingHref}
                    onClick={() => setMenuOpen(false)}
                  >
                    Open ranking
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="product-detail-hero">
        {children}
        <div
          ref={actionRef}
          className="product-detail-hero-actions"
          aria-hidden={compactVisible}
          inert={compactVisible ? true : undefined}
        >
          <BackButtonBordered fallback={fallback} />
          <ProductShareButton variant="overlay" aria-label="Share product" product={product} />
        </div>
      </div>
    </>
  );
}
