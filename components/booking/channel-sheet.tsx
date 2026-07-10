"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import type { BookingChannel, Place } from "@/lib/data";

const CHANNEL_INFO: Record<BookingChannel, { label: string; hint: string }> = {
  naver: { label: "Naver Booking", hint: "Instant confirmation · English form" },
  kakao: { label: "KakaoTalk Channel", hint: "Chat to book · translation-friendly" },
  instagram: { label: "Instagram DM", hint: "Send a reference photo with your request" },
};

export function ChannelSheet({ place, triggerStyle }: { place: Place; triggerStyle?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  useEffect(() => { setHost(document.querySelector(".app-shell")); }, []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} className="btn" style={triggerStyle} onClick={() => setOpen(true)}>Book</button>
      {open && host && createPortal(
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Book ${place.name}`}>
            <div className="shead">
              <div><div className="label">Book via</div><b>{place.name}</b></div>
              <button ref={closeRef} className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size="sm" /></button>
            </div>
            <div className="sbody stack">
              {(place.bookingChannels ?? []).map((c) => (
                <button key={c} className="card tap row between" onClick={() => { toast(`Opening ${CHANNEL_INFO[c].label}…`); setOpen(false); }}>
                  <div style={{ textAlign: "left" }}>
                    <b>{CHANNEL_INFO[c].label}</b>
                    <div className="caption muted">{CHANNEL_INFO[c].hint}</div>
                  </div>
                  <Icon name="ext" size="sm" style={{ color: "var(--dim)" }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>,
        host,
      )}
    </>
  );
}
