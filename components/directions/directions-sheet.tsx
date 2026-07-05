"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { googleMapsUrl, kakaoMapUrl, naverMapUrl } from "@/lib/geo";

export type DirectionsPlace = { name: string; nameKr: string; address: string; lat: number; lng: number };

const APPS = (p: DirectionsPlace) => [
  { label: "KakaoMap", hint: "Best for Korea · English UI available", href: kakaoMapUrl(p.name, p.lat, p.lng), badge: "Recommended" },
  { label: "Naver Map", hint: "Searches the Korean name", href: naverMapUrl(p.nameKr) },
  { label: "Google Maps", hint: "Familiar, lighter local detail", href: googleMapsUrl(p.lat, p.lng) },
];

/** Trigger button + bottom-sheet chooser for map apps, with a taxi card. */
export function DirectionsLauncher({ place, className, children }: { place: DirectionsPlace; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { copy } = useToast();

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} className={className ?? "btn ghost"} onClick={() => setOpen(true)}>
        {children ?? (<><Icon name="pin" size="sm" /> Get Directions</>)}
      </button>

      {open && (
        <>
          <div className="overlay" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Directions to ${place.name}`}>
            <div className="shead">
              <div>
                <div className="label">Get directions</div>
                <b>{place.name}</b>
              </div>
              <button ref={closeRef} className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="sbody stack">
              {APPS(place).map((a) => (
                <a key={a.label} className="card tap row between" href={a.href} target="_blank" rel="noopener noreferrer">
                  <div>
                    <b>{a.label}</b>
                    {a.badge && <span className="badge accent" style={{ marginLeft: 8 }}>{a.badge}</span>}
                    <div className="caption muted">{a.hint}</div>
                  </div>
                  <Icon name="ext" size="sm" style={{ color: "var(--dim)" }} aria-hidden="true" />
                </a>
              ))}

              <div className="taxi-big">
                <div className="label">Show this to your taxi driver</div>
                <div className="taxi-big-name">{place.nameKr}</div>
                <div className="taxi-big-addr">{place.address}</div>
                <button className="btn sm outline" onClick={() => copy(`${place.nameKr}, ${place.address}`)}>
                  <Icon name="copy" size="xs" /> Copy address
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
