import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
export function PhotoLightbox({ photos, index, placeName, onClose, returnFocusRef }: { photos: readonly string[]; index: number; placeName: string; onClose: () => void; returnFocusRef?: RefObject<HTMLElement | null> }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector(".app-shell") ?? document.body); }, []);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The focus hook opens only once the portal target exists, so the trap
  // measures the rendered dialog rather than nothing.
  const dialogRef = useDialogFocus<HTMLDivElement>(host !== null, onClose, closeRef, returnFocusRef);
  const [current, setCurrent] = useState(index);
  // The photo a button or arrow-key scroll is heading to. Until the smooth
  // scroll arrives there, the positions it passes through are not the current
  // photo, and a further press steps on from the target, not from them.
  const pendingTarget = useRef<number | null>(null);
  const clamp = (value: number) => Math.min(photos.length - 1, Math.max(0, value));
  // Edges clamp instead of disabling the buttons: a disabled control under
  // the keyboard focus would drop focus to the page behind the dialog.
  const step = (delta: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = clamp((pendingTarget.current ?? current) + delta);
    pendingTarget.current = target;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: track.clientWidth * target, behavior: reduce ? "auto" : "smooth" });
    setCurrent(target);
  };
  const takeOver = () => { pendingTarget.current = null; }; // a swipe replaces the pending target
  useEffect(() => {
    if (!host) return;
    const track = trackRef.current;
    if (track) track.scrollTo({ left: track.clientWidth * index });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [host, index]);
  // Background isolation: the host's other children go inert while the
  // gallery is open (no pointer, focus or assistive-tech access behind it),
  // restored on close. aria-modal and the Tab trap alone do not disable them.
  useEffect(() => {
    if (!host) return;
    const dialog = dialogRef.current;
    const made = Array.from(host.children).filter((el) => el !== dialog && !el.hasAttribute("inert"));
    made.forEach((el) => el.setAttribute("inert", ""));
    return () => { made.forEach((el) => el.removeAttribute("inert")); };
  }, [host, dialogRef]);
  if (!host) return null;
  // React events bubble through portals: a vertical swipe in the gallery would
  // otherwise reach the map sheet's drag handlers (the DOM target is outside
  // the sheet, so it reads as a drag on the sheet chrome) and fold the sheet
  // behind the lightbox. Key events are left alone — useDialogFocus listens on
  // document for Tab and Escape.
  const stopEvent = (event: React.SyntheticEvent) => event.stopPropagation();
  return createPortal(
    <div
      ref={dialogRef}
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${placeName} photos`}
      tabIndex={-1}
      onPointerDown={stopEvent}
      onPointerMove={stopEvent}
      onPointerUp={stopEvent}
      onPointerCancel={stopEvent}
      onTouchStart={stopEvent}
      onTouchMove={stopEvent}
      onTouchEnd={stopEvent}
      onWheel={stopEvent}
      onClick={stopEvent}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
        else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      }}
    >
      <div className="photo-lightbox-bar">
        <div className="photo-lightbox-nav">
          <IconButton name="back" label="Previous photo" variant="overlay" onClick={() => step(-1)} />
          <span aria-live="polite">{current + 1} / {photos.length}</span>
          <IconButton name="chev" label="Next photo" variant="overlay" onClick={() => step(1)} />
        </div>
        <IconButton buttonRef={closeRef} name="x" label="Close photos" variant="overlay" onClick={onClose} />
      </div>
      <div
        ref={trackRef}
        className="photo-lightbox-track"
        onPointerDown={takeOver}
        onTouchStart={takeOver}
        onWheel={takeOver}
        onScroll={(event) => {
          const el = event.currentTarget;
          const width = Math.max(1, el.clientWidth);
          const at = clamp(Math.round(el.scrollLeft / width));
          if (pendingTarget.current !== null) {
            if (at !== pendingTarget.current) return; // still travelling towards the target
            pendingTarget.current = null;
          }
          setCurrent(at);
        }}
      >
        {photos.map((src, i) => (
          <figure key={src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${placeName} photo ${i + 1} of ${photos.length}`} loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"} decoding="async" />
          </figure>
        ))}
      </div>
    </div>,
    host,
  );
}

