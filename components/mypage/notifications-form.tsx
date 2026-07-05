"use client";

import { useState } from "react";

type Toggle = { key: string; title: string; desc: string; hint: string; on: boolean };

const INITIAL: Toggle[] = [
  { key: "booking", title: "Booking updates", desc: "Confirmations, reminders 48h & 6h before, schedule changes.", hint: "Email · Push", on: true },
  { key: "kit", title: "Hair kit status", desc: "When your kit is preparing, ready for pickup, or expiring.", hint: "Email", on: true },
  { key: "journal", title: "New journal stories", desc: "Curated K-beauty guides, occasional drops.", hint: "Email", on: false },
  { key: "promo", title: "Promotions & events", desc: "Olive Young deals, Seoul beauty events, Essenly campaigns.", hint: "Email", on: false },
];

export function NotificationsForm() {
  const [rows, setRows] = useState(INITIAL);
  const toggle = (key: string) => setRows((r) => r.map((x) => (x.key === key ? { ...x, on: !x.on } : x)));

  return (
    <div className="stack">
      {rows.map((r) => (
        <div className="card row between" key={r.key} style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <b>{r.title}</b>
            <div className="caption muted" style={{ marginTop: 2 }}>{r.desc}</div>
            <div className="label" style={{ marginTop: 6 }}>{r.hint}</div>
          </div>
          <button
            role="switch"
            aria-checked={r.on}
            aria-label={r.title}
            onClick={() => toggle(r.key)}
            style={{
              width: 46, height: 28, borderRadius: 999, flex: "none",
              background: r.on ? "var(--accent)" : "var(--border)",
              position: "relative", transition: "background .2s",
            }}
          >
            <span style={{
              position: "absolute", top: 3, left: r.on ? 21 : 3, width: 22, height: 22,
              borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "var(--shadow-card)",
            }} />
          </button>
        </div>
      ))}
      <div className="card"><p className="caption muted">These preferences apply across email and push (PWA). SMS for Korean numbers is coming later.</p></div>
    </div>
  );
}
