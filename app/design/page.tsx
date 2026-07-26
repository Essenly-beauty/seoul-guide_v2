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
import { ListRow } from "@/components/ui/list-row";
import { SearchField } from "@/components/ui/search-field";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/notice";
import { SectionDivider } from "@/components/ui/section-divider";
import { Icon } from "@/components/icon";
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
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [noticeShown, setNoticeShown] = useState(true);
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

        <SectionDivider />
        <SectionHeader title="Category tokens" />
        <div className="chipwrap">
          {MAP_CATEGORIES.filter((c) => c.key !== "all").map((c) => (
            <Chip key={c.key}><CategoryBadge type={c.key as PlaceType} size={16} />{c.label}</Chip>
          ))}
        </div>
        <div className="t-caption mono">{Object.values(TYPE_COLOR).join(" · ")}</div>

        <SectionDivider />
        <SectionHeader title="Typography" />
        <div className="stack sm">
          <span className="t-heading-sm">t-heading-sm · Section title 16/700</span>
          <span style={{ fontSize: 14 }}>body · 14/400 — the quick brown fox</span>
          <span className="t-label-md">t-label-md · Row title 13/500</span>
          <span className="t-label-sm">t-label-sm · Badge label 12/500</span>
          <span className="t-caption">t-caption · Meta caption 12/400 muted</span>
          <span className="mono num">num mono · 12,345 ₩₩₩ 4.5</span>
        </div>

        <SectionDivider />
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

        <SectionDivider />
        <SectionHeader title="Icon buttons" />
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <IconButton name="share" label="Share (plain)" />
          <IconButton name="heart-o" label="Save (soft)" variant="soft" />
          <IconButton name="back" label="Back (overlay)" variant="overlay" />
          <IconButton name="x" label="Disabled icon button" disabled />
          <span className="t-caption">plain · soft · overlay(사진 위)</span>
        </div>

        <SectionDivider />
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

        <SectionDivider />
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

        {/* ── Basics (v2 basic components) ─────────────────── */}
        <SectionDivider />
        <SectionHeader title="List rows" />
        <div>
          <ListRow
            href="#"
            media={<ImgPh className="thumb56" />}
            titleAccessory={<CategoryBadge type="skin_clinic" size={16} />}
            title="HOSU DOSAN"
            caption="Skin clinic · Apgujeong · ₩₩₩"
            meta={<><RatingLine rating={4.5} count={96} plain /><span aria-hidden="true">·</span><LiveBadge hours={demoHours} showUntil={false} /></>}
            trailing={<IconButton name="heart-o" label="Save" variant="soft" iconSize="xs" />}
          />
          <ListRow
            media={<span className="ic"><Icon name="book" size="sm" /></span>}
            title="Icon-led row"
            caption="May 4 · 5 min read"
            trailing={<Icon name="chev" size="xs" style={{ color: "var(--dim)" }} />}
          />
        </div>
        <div className="t-caption">thumb56 / .ic media 슬롯 · trailing이 있으면 링크는 콘텐츠에만</div>

        <SectionDivider />
        <SectionHeader title="Search field" />
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search demo"
          placeholder="Salons, products, districts…"
          onClear={() => setQuery("")}
        />
        <div className="t-caption">{query ? `query: "${query}"` : "type to see the clear button"}</div>

        <SectionDivider />
        <SectionHeader title="Bottom sheet" />
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
        {sheetOpen && (
          <BottomSheet
            title="Bottom sheet"
            kicker="Demo"
            onClose={() => setSheetOpen(false)}
            footer={<Button full onClick={() => setSheetOpen(false)}>Apply</Button>}
          >
            <p className="t-caption">Portals to .app-shell · overlay tap / Escape closes · focus trapped.</p>
          </BottomSheet>
        )}

        <SectionDivider />
        <SectionHeader title="Switch" />
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="t-label-md" style={{ fontSize: 14, display: "block" }}>Booking updates</b>
            <div className="t-caption" id="design-switch-desc">role=&quot;switch&quot; · notifications-form pattern</div>
          </div>
          <Switch checked={switchOn} onChange={setSwitchOn} label="Booking updates" describedBy="design-switch-desc" />
          <Switch checked onChange={() => {}} label="Disabled switch" disabled />
        </div>

        <SectionDivider />
        <SectionHeader title="Badges" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Badge tone="accent">NEW</Badge>
          <Badge tone="warning">D-5</Badge>
          <Badge tone="info">EN OK</Badge>
          <Badge tone="success">OPEN</Badge>
          <Badge tone="error">ERROR</Badge>
          <Badge tone="dim">11</Badge>
        </div>

        <SectionDivider />
        <SectionHeader title="Empty state" />
        <EmptyState icon="heart" action={<Button size="sm" variant="tonal">Explore places</Button>}>
          Nothing saved yet — tap ♥ on any place.
        </EmptyState>

        <SectionDivider />
        <SectionHeader title="Avatar" />
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <Avatar name="Sarah" />
          <Avatar name="Sarah" size={44} />
          <Avatar name="Sarah" size={52} />
          <Avatar size={44} />
          <span className="t-caption">30(기본) · 44 · 52 · no-name fallback</span>
        </div>

        <SectionDivider />
        <SectionHeader title="Notice" />
        <Notice tone="info">Location is off — showing <b>Gangnam Station</b> as your starting point.</Notice>
        {noticeShown ? (
          <Notice tone="warning" icon="cross" onDismiss={() => setNoticeShown(false)}>
            Medical procedures require a consultation before booking.
          </Notice>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setNoticeShown(true)}>Restore dismissed notice</Button>
        )}
      </div>
    </>
  );
}
