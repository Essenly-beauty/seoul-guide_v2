"use client";

import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/icon";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { BookingChannel, Place } from "@/lib/data";

const CHANNEL_INFO: Record<BookingChannel, { label: string; hint: string }> = {
  naver: { label: "Naver Booking", hint: "Instant confirmation · English form" },
  kakao: { label: "KakaoTalk Channel", hint: "Chat to book · translation-friendly" },
  instagram: { label: "Instagram DM", hint: "Send a reference photo with your request" },
};

export function ChannelSheet({ place, triggerStyle }: { place: Place; triggerStyle?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  return (
    <>
      <Button style={triggerStyle} onClick={() => setOpen(true)}>Book</Button>
      {open && (
        <BottomSheet
          title={place.name}
          kicker="Book via"
          onClose={() => setOpen(false)}
        >
          {(place.bookingChannels ?? []).map((c) => (
            <button key={c} className="card tap row between" onClick={() => { toast(`Opening ${CHANNEL_INFO[c].label}…`); setOpen(false); }}>
              <div style={{ textAlign: "left" }}>
                <b>{CHANNEL_INFO[c].label}</b>
                <div className="caption muted">{CHANNEL_INFO[c].hint}</div>
              </div>
              <Icon name="ext" size="sm" style={{ color: "var(--dim)" }} aria-hidden="true" />
            </button>
          ))}
        </BottomSheet>
      )}
    </>
  );
}
