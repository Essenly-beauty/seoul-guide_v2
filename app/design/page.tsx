"use client";

// Living design-system showcase (docs/design-system.md §4) — the reference
// point for consistency checks. Dev-facing; not linked from the app nav.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Chip, StatusChip } from "@/components/ui/chip";
import { CategoryBadge } from "@/components/category/category-badge";
import { LiveBadge } from "@/components/ui/live-badge";
import { RatingLine } from "@/components/ui/rating-line";
import { RatingBars } from "@/components/ui/rating-bars";
import { SectionHeader } from "@/components/ui/section-header";
import { ImgPh } from "@/components/ui/img-ph";
import { TopBar } from "@/components/ui/top-bar";
import { MAP_CATEGORIES, TYPE_COLOR, TYPE_LABEL, type PlaceType } from "@/lib/data";

const SEMANTIC_COLORS = [
  ["--brand", "Brand"], ["--brand-soft", "Brand soft"], ["--text-primary", "Text primary"],
  ["--text-secondary", "Text secondary"], ["--text-disabled", "Text disabled"],
  ["--bg-surface", "Surface"], ["--bg-surface-sunken", "Surface sunken"], ["--border-default", "Border"],
  ["--live", "LIVE"], ["--me", "My location"], ["--warning", "Rating star"],
] as const;

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: `var(${token})`, border: "1px solid var(--border)", flex: "none" }} />
      <div style={{ minWidth: 0 }}>
        <div className="t-label-sm">{label}</div>
        <div className="t-caption mono">{token}</div>
      </div>
    </div>
  );
}

export default function DesignShowcase() {
  const [chip, setChip] = useState("all");
  const demoHours = { open: "09:00", close: "23:59" };
  return (
    <>
      <TopBar title="Design system" />
      <div className="app-scroll pad stack pagev2" style={{ background: "var(--bg-surface)" }}>
        <div>
          <div className="label">Foundation</div>
          <div className="h1">Essenly <span style={{ fontStyle: "italic", color: "var(--accent)" }}>design system.</span></div>
          <p className="t-caption" style={{ marginTop: 4 }}>docs/design-system.md · raw → semantic → component</p>
        </div>

        <SectionHeader title="Semantic colors" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SEMANTIC_COLORS.map(([t, l]) => <Swatch key={t} token={t} label={l} />)}
        </div>

        <hr className="sec-divider" />
        <SectionHeader title="Category tokens" />
        <div className="chipwrap">
          {MAP_CATEGORIES.filter((c) => c.key !== "all").map((c) => (
            <Chip key={c.key}><CategoryBadge type={c.key as PlaceType} size={16} />{c.label}</Chip>
          ))}
        </div>
        <div className="t-caption mono">{Object.values(TYPE_COLOR).join(" · ")}</div>

        <hr className="sec-divider" />
        <SectionHeader title="Typography" />
        <div className="stack sm">
          <span className="t-heading-sm">t-heading-sm · Section title 16/700</span>
          <span style={{ fontSize: 14 }}>body · 14/400 — the quick brown fox</span>
          <span className="t-label-md">t-label-md · Row title 13/500</span>
          <span className="t-label-sm">t-label-sm · Badge label 12/500</span>
          <span className="t-caption">t-caption · Meta caption 12/400 muted</span>
          <span className="mono num">num mono · 12,345 ₩₩₩ 4.5</span>
        </div>

        <hr className="sec-divider" />
        <SectionHeader title="Buttons" />
        <div className="stack sm">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tonal">Tonal</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button size="sm">Primary sm</Button>
            <Button variant="secondary" size="sm">More ›</Button>
            <Button variant="tonal" size="sm" icon="gift">With icon</Button>
            <Button size="sm" disabled>Disabled</Button>
          </div>
          <Button full>Full width</Button>
          <div className="t-caption">한 화면에 primary 1개 · secondary=더보기류 기본 · tonal=primary 짝</div>
        </div>

        <hr className="sec-divider" />
        <SectionHeader title="Icon buttons" />
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <IconButton name="share" label="Share (plain)" />
          <IconButton name="heart-o" label="Save (soft)" variant="soft" />
          <IconButton name="back" label="Back (overlay)" variant="overlay" />
          <span className="t-caption">plain · soft · overlay(사진 위)</span>
        </div>

        <hr className="sec-divider" />
        <SectionHeader title="Chips" />
        <div className="chipwrap">
          {["all", "olive_young", "skin_clinic"].map((k) => (
            <Chip key={k} selected={chip === k} onClick={() => setChip(k)}>
              {k === "all" ? "All" : <><CategoryBadge type={k as PlaceType} size={16} />{TYPE_LABEL[k as PlaceType]}</>}
            </Chip>
          ))}
          <Chip soft selected>soft selected</Chip>
          <Chip mono>₩₩</Chip>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <StatusChip status="confirmed" /><StatusChip status="pending" /><StatusChip status="cancelled" />
        </div>

        <hr className="sec-divider" />
        <SectionHeader title="Badges & meta" />
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <RatingLine rating={4.5} count={96} />
          <RatingLine rating={4.5} count={96} plain />
          <LiveBadge hours={demoHours} />
        </div>
        <div className="row" style={{ gap: 16 }}>
          <RatingBars dist={[62, 24, 9, 3, 2]} />
          <ImgPh className="thumb56" />
        </div>
      </div>
    </>
  );
}
