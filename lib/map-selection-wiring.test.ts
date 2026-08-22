import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screenSource = readFileSync(new URL("../components/map/map-screen.tsx", import.meta.url), "utf8");
const sheetSource = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");
const viewSource = readFileSync(new URL("../components/map/map-view.tsx", import.meta.url), "utf8");
const navSource = readFileSync(new URL("../components/ui/bottom-nav.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../components/place/place-detail-body.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const summaryUrl = new URL("../components/map/selected-place-summary.tsx", import.meta.url);
const summarySource = existsSync(summaryUrl) ? readFileSync(summaryUrl, "utf8") : "";

describe("map place selection wiring", () => {
  it("routes list selection through the camera-aware place handler", () => {
    const handler = screenSource.match(/const handleMapSelect[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? "";

    expect(screenSource).toMatch(/<MapSheet[\s\S]*?onSelect=\{handleMapSelect\}/);
    expect(handler).toContain("setFlyTarget({ lat: place.lat, lng: place.lng })");
    expect(handler).not.toContain('mode !== "subway"');
    expect(handler).toContain("setMoved(false)");
    expect(handler).toContain("setFlyTarget(null)");
    expect(handler).toContain("initialLocationHandledRef.current = true");
  });

  it("measures the live sheet overlap and biases the anchor for callout headroom", () => {
    // User decision (2026-07-25): selecting a place keeps the sheet at its snap —
    // the camera centers within the map strip actually visible above it.
    expect(screenSource).toContain('focusYBias={mode === "map" && selectedId ? 0.62 : 0.5}');
    expect(viewSource).toContain('".subway-controller, .mapsheet"');
    expect(viewSource).toContain("bottomInsetPx?: number");
  });

  it("keeps the sheet as the only selected-place presentation", () => {
    expect(sheetSource).toContain("`mapsheet ${snap}${dragging");
    expect(sheetSource).not.toContain('"selected peek"');
    expect(viewSource).not.toContain("SelectedPlaceCallout");
    expect(viewSource).not.toContain("showSelectedCallout");
    expect(screenSource).not.toContain("showSelectedCallout=");
  });

  it("restores a stable list control after dismissing the selected sheet", () => {
    expect(sheetSource).toContain("rowRefs.current.get(placeId)");
    expect(sheetSource).toContain("target?.focus({ preventScroll: true })");
    expect(sheetSource).toContain("returnPlaceId.current = p.id");
  });

  it("exposes each place marker's category and selected state", () => {
    expect(viewSource).toContain('element.setAttribute("aria-pressed", String(selected))');
    expect(viewSource).toMatch(/labelMarker\([\s\S]*?TYPE_LABEL\[p\.type\][\s\S]*?selected,/);
  });

  it("describes the map sheet snap and controlled places list", () => {
    expect(sheetSource).toContain('aria-expanded={snap !== "peek"}');
    expect(sheetSource).toContain("aria-controls={listId}");
    expect(sheetSource).toContain("id={listId}");
    expect(sheetSource).toContain("Nearby places list, half expanded.");
    expect(sheetSource).toContain("Nearby places list, fully expanded.");
  });

  it("announces active filter count and dialog state", () => {
    expect(screenSource).toContain("aria-label={filterLabel}");
    expect(screenSource).toContain("aria-expanded={filterOpen}");
    expect(screenSource).toContain('aria-haspopup="dialog"');
    expect(screenSource).toContain("activeFilterCount");
  });

  it("centers the active subway station instead of fitting asymmetric nearby places", () => {
    expect(screenSource).not.toContain("focusPoints={subwayFocusPoints}");
    expect(viewSource).toContain('querySelector<HTMLElement>(".subway-controller")');
  });

  it("lets an explicit location retry reclaim the camera", () => {
    const locateHandler = screenSource.match(/aria-label="Center on my location"[\s\S]*?<\/button>/)?.[0] ?? "";

    expect(locateHandler).toContain("initialLocationHandledRef.current = false");
    expect(locateHandler).toContain("retry()");
  });

  it("keeps the compact selected-place summary inside the lower sheet", () => {
    expect(screenSource).not.toContain("<SelectedPlaceToolbar");
    expect(screenSource).toContain("moved={moved}");
    expect(sheetSource).toContain('variant="compact"');
    expect(sheetSource).toContain('selectedView === "compact"');
    expect(sheetSource).toContain("onOpen");
    expect(sheetSource).toContain("onDismiss");
  });

  it("uses one density-aware selected-place summary for half and compact states", () => {
    expect(summarySource).toContain("export function SelectedPlaceSummary");
    expect(summarySource).toContain('variant: "half" | "compact"');
    expect(summarySource).toContain("<LiveBadge");
    expect(summarySource).toContain("selected-place-summary-title");
    expect(summarySource).toContain("selected-place-summary-header");
    expect(summarySource).toContain("selected-place-summary-media-grid");
  });

  it("keeps the compact summary decision-ready without showing its photo gallery", () => {
    const compactBranch = summarySource.match(/if \(variant === "compact"\)[\s\S]*?\n  }\n\n  return/)?.[0] ?? "";

    expect(compactBranch).toContain("selected-place-summary-title-row");
    expect(compactBranch).toContain("selected-place-summary-address");
    expect(compactBranch).toContain("formatCompactDistance(km)");
    expect(compactBranch).not.toContain("selected-place-summary-media-grid");
  });

  it("does not show walking duration in the nearby-place list", () => {
    expect(sheetSource).not.toContain("walkMinutes");
    expect(sheetSource).not.toMatch(/min walk/);
  });

  it("shows a store thumbnail when available and keeps the pin as an honest fallback", () => {
    expect(sheetSource).toContain("p.photoUrl ? (");
    expect(sheetSource).toContain('className="maprow-photo"');
    expect(sheetSource).toContain('alt=""');
    expect(sheetSource).toContain('className="maprow-photo-fallback"');
    expect(sheetSource).toContain('<Icon name="pin"');
  });

  it("reuses the direct place-detail body and CTA at the full snap", () => {
    expect(sheetSource).toContain("<PlaceDetailBody");
    expect(sheetSource).toContain("<PlaceCtaBar");
    expect(sheetSource).toContain('onCollapse={() =>');
    expect(detailSource).toContain("onCollapse?: () => void");
    expect(sheetSource).not.toContain("View full details");
    expect(sheetSource).toContain("handleDetailScroll");
    expect(sheetSource).toContain("scrollTop > 4");
    expect(sheetSource).toContain('setSnap("full")');
    expect(detailSource).toContain('className="place-detail-collapse"');
    expect(detailSource).toContain('label="Collapse place details"');
  });

  it("keeps opening status first in selected summaries and nearby rows", () => {
    const compactSummary = summarySource.match(/if \(variant === "compact"\)[\s\S]*?\n  }\n\n  return/)?.[0] ?? "";
    const nearbyMeta = sheetSource.match(/<div className="caption muted maprow-meta">[\s\S]*?<\/div>/)?.[0] ?? "";
    const detailMeta = detailSource.match(/<div className="row" style=\{\{ gap: 8, marginTop: 8 \}\}>[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(compactSummary.indexOf("<LiveBadge")).toBeGreaterThanOrEqual(0);
    expect(compactSummary.indexOf("<LiveBadge")).toBeLessThan(compactSummary.indexOf("formatCompactDistance"));
    expect(nearbyMeta.indexOf("<LiveBadge")).toBeGreaterThanOrEqual(0);
    expect(nearbyMeta.indexOf("<LiveBadge")).toBeLessThan(nearbyMeta.indexOf("formatCompactDistance"));
    expect(detailMeta.indexOf("<LiveBadge")).toBeGreaterThanOrEqual(0);
    expect(detailMeta.indexOf("<LiveBadge")).toBeLessThan(detailMeta.indexOf("<RatingLine"));
  });

  it("groups distance and rating as compact, non-breaking metadata tokens", () => {
    expect(sheetSource).toContain('className="map-meta-token mono"');
    expect(sheetSource).toContain("formatCompactDistance(km)");
    expect(sheetSource).toContain('className="map-meta-token stars"');
    expect(sheetSource).toContain("★{p.rating}");
    expect(summarySource).toContain("formatCompactDistance(km)");
    expect(summarySource).toContain("★{place.rating}");
  });

  it("collapses the selected detail sheet after a map move", () => {
    expect(sheetSource).toContain("moved?: boolean");
    expect(sheetSource).toContain("if (moved)");
    expect(sheetSource).toContain('setSnap("peek")');
    expect(sheetSource).not.toContain("selectedCollapsed");
  });

  it("renders exactly one selected-place presentation for each stable snap", () => {
    expect(sheetSource).toContain("resolveSelectedPlaceView(snap)");
    expect(sheetSource).toContain('selectedView === "compact"');
    expect(sheetSource).toContain('selectedView === "summary"');
    expect(sheetSource).toContain('selectedView === "detail"');
    expect(sheetSource).not.toContain('selectedPlace && snap !== "full"');
  });

  it("uses a fast transform-only snap animation without changing selected-sheet height", () => {
    const sheetRule = cssSource.match(/\.mapsheet \{[\s\S]*?\n  \}/)?.[0] ?? "";

    expect(sheetRule).toContain("transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)");
    expect(sheetRule).not.toMatch(/transition:\s*(?:all|height)/);
    expect(sheetRule).toContain("--sheet-peek-height: 62px");
    expect(cssSource).toMatch(/\.mapsheet\.has-selection\s*\{[^}]*height:\s*100%;/);
    expect(cssSource).toMatch(/\.mapsheet\.half\.has-selection\s*\{\s*transform:\s*translateY\(52%\);/);
    expect(cssSource).toMatch(/\.mapsheet\.peek\.has-selection\s*\{[^}]*transform:\s*translateY\(calc\(100% - var\(--selected-sheet-peek-height\)\)\)/);
    expect(cssSource).not.toMatch(/\.mapsheet\.peek\s*\{[^}]*height:\s*auto/);
    expect(sheetSource).toContain("selectedPlace ? 136 : 62");
    expect(cssSource).toContain(".mapsheet.dragging { transition: none; }");
  });

  it("opens the places sheet halfway and cycles from the Map tab", () => {
    expect(sheetSource).toContain('useState<Snap>("half")');
    expect(sheetSource).toContain('myseouldrop:map-cycle');
    expect(sheetSource).toContain("setSnap(nextMapSheetSnap)");
    expect(navSource).toContain('myseouldrop:map-cycle');
    expect(screenSource).not.toContain('showSelectedCallout=');
  });

  it("snaps a released drag to the nearest full, half, or peek height", () => {
    const releaseHandler = sheetSource.match(/const onPointerUp[\s\S]*?\n  };/)?.[0] ?? "";

    expect(releaseHandler).toContain("const nearest");
    expect(releaseHandler).toContain("setSnap(nearest)");
    expect(releaseHandler).toContain("setOffset(null)");
    expect(releaseHandler).not.toContain("setOffset(d.last)");
  });

  it("offers a location retry and a settings guidance link when location is off", () => {
    expect(screenSource).toContain('status === "fallback"');
    expect(screenSource).toContain('onClick={retry}');
    expect(screenSource).toContain('href={`${routes.settingsApp}#location`}');
  });

  it("requests heading permission from a locate tap even when GPS already succeeded", () => {
    const locateHandler = screenSource.match(/aria-label="Center on my location"[\s\S]*?<\/button>/)?.[0] ?? "";

    expect(screenSource).toContain("requestHeading");
    expect(locateHandler).toContain("if (loc)");
    expect(locateHandler).toContain("requestHeading()");
  });

  it("passes a live heading into the current-location marker", () => {
    expect(viewSource).toContain("userHeading");
    expect(viewSource).toContain("pin-me-arrow");
    expect(screenSource).toContain("userHeading={heading}");
  });

  it("keeps experimental two-finger rotation behind an explicit release flag", () => {
    expect(viewSource).toContain("event.touches.length !== 2");
    expect(viewSource).toContain("style.rotate");
    expect(viewSource).toContain('aria-label="Reset map rotation"');
    expect(viewSource).toContain('process.env.NEXT_PUBLIC_ENABLE_EXPERIMENTAL_MAP_ROTATION === "1"');
    expect(viewSource).toContain("{rotationEnabled && (");
  });

  it("renders larger grouped transfer-station discs", () => {
    expect(viewSource).toContain("st.lines.slice(0, 3)");
    expect(viewSource).toContain("station-disc-row");
  });
});

describe("selected-pin sheet owns the bottom of the screen (Kakao pattern)", () => {
  const bar = readFileSync(new URL("../components/map/selected-place-action-bar.tsx", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("offers save, share, and all three route hand-offs", () => {
    expect(bar).toContain("FavoriteButton");
    expect(bar).toContain("Share ${place.name}");
    expect(bar).toContain("MapLinkButtons");
  });

  it("renders the bar outside the transformed sheet so it lands on screen", () => {
    // .mapsheet is positioned by a transform, which makes it the containing
    // block for fixed children — an in-sheet bar sits at the sheet's
    // off-screen bottom instead of the visitor's.
    const afterSection = sheet.slice(sheet.lastIndexOf("</section>"));
    expect(afterSection).toContain("SelectedPlaceActionBar");
    expect(styles).toContain(".selected-place-actions {\n    position: absolute;");
  });

  it("hands the tab bar's space to the sheet for any selection, not just full", () => {
    expect(styles).toContain("body:has(.mapsheet.has-selection) .bottomnav");
  });

  it("keeps the photo rail swipeable and two-up without faking tiles", () => {
    const summary = readFileSync(new URL("../components/map/selected-place-summary.tsx", import.meta.url), "utf8");
    expect(styles).toContain("scroll-snap-type: x mandatory");
    expect(styles).toContain("flex: 0 0 calc(50% - 4px)");
    // the empty state stays a single honest block
    expect(summary).toContain("photos.length > 0");
    expect(summary).toContain("Photos coming soon");
  });
});
