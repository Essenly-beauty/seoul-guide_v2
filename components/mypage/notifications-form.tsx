"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Switch } from "@/components/ui/switch";

type Toggle = { key: string; icon: IconName; title: string; desc: string; hint: string; on: boolean };

const INITIAL: Toggle[] = [
  { key: "booking", icon: "cal", title: "Booking updates", desc: "Confirmations, reminders 48h & 6h before, schedule changes.", hint: "Email · Push", on: true },
  { key: "kit", icon: "gift", title: "Hair kit status", desc: "When your kit is preparing, ready for pickup, or expiring.", hint: "Email", on: true },
  { key: "journal", icon: "book", title: "New journal stories", desc: "Curated K-beauty guides, occasional drops.", hint: "Email", on: false },
  { key: "promo", icon: "bell", title: "Promotions & events", desc: "Olive Young deals, Seoul beauty events, Essenly campaigns.", hint: "Email", on: false },
];

export function NotificationsForm() {
  const [rows, setRows] = useState(INITIAL);
  const toggle = (key: string) => setRows((r) => r.map((x) => (x.key === key ? { ...x, on: !x.on } : x)));

  return (
    <div className="stack sm">
      <div>
        {rows.map((r) => (
          <div className="listrow v2" key={r.key}>
            <span className="ic"><Icon name={r.icon} size="sm" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="t-label-md" style={{ fontSize: 14, display: "block" }}>{r.title}</b>
              <div className="t-caption">{r.desc}</div>
              <div className="t-label-sm" style={{ color: "var(--dim)", marginTop: 2 }}>{r.hint}</div>
            </div>
            <Switch checked={r.on} label={r.title} onChange={() => toggle(r.key)} />
          </div>
        ))}
      </div>
      <p className="t-caption">These preferences apply across email and push (PWA). SMS for Korean numbers is coming later.</p>
    </div>
  );
}
