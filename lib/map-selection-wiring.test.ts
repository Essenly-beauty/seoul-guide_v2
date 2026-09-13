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
  it("shows an honest chain-wide Daiso ranking preview in Daiso store details", () => {
    expect(detailSource).toContain("function DaisoPicks");
    expect(detailSource).toContain('<SectionHeader title="Daiso Ranking"');
    expect(detailSource).toContain('selectDaisoRanking("daily").slice(0, 4)');
    expect(detailSource).toContain("Daiso Mall ranking — chain-wide chart, stock varies by branch.");
    expect(detailSource).toContain("routes.daisoProduct(p.productNo)");
    expect(detailSource).toContain('routes.rankingRetailer("daiso")');
    expect(detailSource).toContain('place.type === "daiso"');
  });
  it("wires exact-coordinate group selection from the map into the sheet", () => {
    const groupHandler = screenSource.match(
      /const handleMapGroupSelect[\s\S]*?\n  \}, \[[^\]]*\]\);/,
    )?.[0] ?? "";

    expect(viewSource).toContain("onSelectGroup: (ids: string[]) => void");
    expect(viewSource).toContain("groupPlacesByCoordinate");
    expect(viewSource).toContain("`${group.ids.length} places at this pin`");
    expect(viewSource).toContain("click: () => onSelectGroup(group.ids)");
    expect(screenSource).toContain("const [selectedGroupIds, setSelectedGroupIds]");
    expect(groupHandler).toContain('setMode("map")');
    expect(groupHandler.indexOf('setMode("map")')).toBeLessThan(
      groupHandler.indexOf("setSelectedGroupIds(places.map"),
    );
    expect(screenSource).toContain("onSelectGroup={handleMapGroupSelect}");
    expect(screenSource).toContain("groupPlaceIds={selectedGroupIds}");
    expect(sheetSource).toContain("groupPlaceIds?: string[]");
    expect(sheetSource).toContain("places at this pin");
    expect(sheetSource).toContain("onSelect(place.id)");
  });

  it("routes list selection through the camera-aware place handler", () => {
    const handler = screenSource.match(/const handleMapSelect[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? "";

    expect(screenSource).toMatch(/<MapSheet[\s\S]*?onSelect=\{handleMapSelect\}/);
    expect(handler).toContain("setFlyTarget({ lat: place.lat, lng: place.lng })");
    expect(handler).not.toContain('mode !== "subway"');
    expect(handler).toContain("setMoved(false)");
    expect(handler).toContain("setFlyTarget(null)");
    expect(handler).toContain("initialLocationHandledRef.current = true");
  });

  it("keeps an explicitly selected place on the marker layer when filters exclude it", () => {
    expect(screenSource).toContain("includeSelectedPlace(places, selectedId, getPlace)");
    expect(screenSource).toContain("places={markerPlaces}");
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

  it("announces both the English and official Korean place names from map markers", () => {
    expect(viewSource).toContain("function placeAccessibleName(place: Place)");
    expect(viewSource).toContain('`${place.name}, ${place.nameKr}`');
    expect(viewSource).toContain("title={`${placeAccessibleName(p)}, ${TYPE_LABEL[p.type]}`}");
    expect(viewSource).toContain("alt={`${placeAccessibleName(p)}, ${TYPE_LABEL[p.type]}`}");
    expect(viewSource).toMatch(/labelMarker\([\s\S]*?placeAccessibleName\(p\)[\s\S]*?selected,/);
  });

  it("keeps both names reachable when multiple official branches share a marker", () => {
    expect(viewSource).toContain("function coordinateGroupAccessibleName(group: PlaceCoordinateGroup, places: Place[])");
    expect(viewSource).toContain(".map((place) => placeAccessibleName(place))");
    expect(viewSource).toContain("title={coordinateGroupAccessibleName(group, places)}");
    expect(viewSource).toContain("alt={coordinateGroupAccessibleName(group, places)}");
    expect(viewSource).toContain("labelMarker(event.target as L.Marker, coordinateGroupAccessibleName(group, places))");
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
    expect(compactBranch).toContain('className="place-name-secondary"');
    expect(compactBranch).toContain("{place.nameKr}");
    expect(compactBranch).toContain("selected-place-summary-address");
    expect(compactBranch).toContain("formatCompactDistance(km)");
    expect(compactBranch).not.toContain("selected-place-summary-media-grid");
  });

  it("renders English first and Korean second in every map sheet place row", () => {
    const generalRows = sheetSource.slice(sheetSource.indexOf(": !selectedPlace ? ranked.map"));

    expect(sheetSource.match(/className="place-name-primary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sheetSource.match(/className="place-name-secondary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(generalRows.indexOf("{p.name}")).toBeLessThan(generalRows.indexOf("{p.nameKr}"));
    expect(generalRows).toContain('lang="ko"');
  });

  it("renders English first and Korean second in both selected summary densities", () => {
    expect(summarySource.match(/className="place-name-primary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(summarySource.match(/className="place-name-secondary"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(summarySource.match(/lang="ko"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("does not let compact-summary labels hide the official Korean name from assistive technology", () => {
    expect(summarySource).toContain("const accessibleName = place.nameKr && place.nameKr !== place.name");
    expect(summarySource).toContain("aria-label={`Open ${accessibleName}`}");
    expect(summarySource).toContain("aria-label={`Close ${accessibleName}`}");
  });

  it("renders the same English-primary, Korean-secondary hierarchy on place details", () => {
    const titleBlock = detailSource.slice(
      detailSource.indexOf("function TitleBlock"),
      detailSource.indexOf("function PlaceAddressDisclosure"),
    );

    expect(titleBlock).toContain('className="place-name-primary"');
    expect(titleBlock).toContain('className="place-name-secondary"');
    expect(titleBlock).toContain('lang="ko"');
    expect(titleBlock.indexOf("{place.name}")).toBeLessThan(titleBlock.indexOf("{place.nameKr}"));
  });

  it("discloses official Daiso provenance without treating name verification as English support", () => {
    expect(detailSource).toContain('place.source === "daiso"');
    expect(detailSource).toContain('place.nameVerification === "provisional"');
    expect(detailSource).toContain("Official Daiso store listing");
    expect(detailSource).toContain("not yet been verified on Naver Map or Google");
    expect(detailSource).not.toMatch(/nameVerification[\s\S]{0,120}englishOk|englishOk[\s\S]{0,120}nameVerification/);
  });

  it("does not show walking duration in the nearby-place list", () => {
    expect(sheetSource).not.toContain("walkMinutes");
    expect(sheetSource).not.toMatch(/min walk/);
  });

  it("shows a store thumbnail when available, else the brand mark or the category's map-pin glyph", () => {
    expect(sheetSource).toContain("function MapRowThumb");
    expect(sheetSource).toContain("{placePhoto ? (");
    expect(sheetSource).toContain('className="maprow-photo"');
    expect(sheetSource).toContain('alt=""');
    // Known retailers get their own mark (public/brands), never a generic pin.
    expect(sheetSource).toContain("const brandMark = BRAND_MARK_SRC[place.type]");
    expect(sheetSource).toContain('<img className="maprow-brand-mark" src={brandMark} alt="" />');
    // Everything else mirrors the map pin: TYPE_ICON glyph in TYPE_COLOR.
    expect(sheetSource).toContain('className="maprow-photo-fallback" style={{ color: TYPE_COLOR[place.type] }}');
    expect(sheetSource).toContain("<Icon name={TYPE_ICON[place.type]}");
    // Both row kinds share the one component.
    expect(sheetSource.match(/<MapRowThumb place=/g)).toHaveLength(2);
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

    // iOS sheet curve for programmatic snaps; a finger release uses a velocity-driven spring instead
    expect(sheetRule).toContain("transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)");
    expect(sheetRule).not.toMatch(/transition:\s*(?:all|height)/);
    expect(sheetRule).toContain("--sheet-peek-height: 62px");
    expect(cssSource).toMatch(/\.mapsheet\.has-selection\s*\{[^}]*height:\s*100%;/);
    expect(cssSource).toMatch(/\.mapsheet\.half\.has-selection\s*\{\s*transform:\s*translateY\(52%\);/);
    expect(cssSource).toMatch(/\.mapsheet\.peek\.has-selection\s*\{[^}]*transform:\s*translateY\(calc\(100% - var\(--selected-sheet-peek-height\)\)\)/);
    expect(cssSource).not.toMatch(/\.mapsheet\.peek\s*\{[^}]*height:\s*auto/);
    // measured from content now — 136px clipped the category line whenever a
    // long name wrapped to two lines (owner report 2026-08-23)
    expect(sheetSource).toContain("peek: Math.max(0, h - peekVisibleHeight())");
    // …and the class rule is handed that measurement so settle target and resting position agree
    expect(sheetSource).toContain('el.style.setProperty("--selected-sheet-peek-height", `${peekVisibleHeight()}px`)');
    expect(cssSource).toContain(".mapsheet.dragging { transition: none; }");
  });

  it("opens the places sheet halfway and cycles from the Map tab", () => {
    expect(sheetSource).toContain('useState<Snap>("half")');
    expect(sheetSource).toContain('myseouldrop:map-cycle');
    expect(sheetSource).toContain("setSnap(nextMapSheetSnap)");
    expect(navSource).toContain('myseouldrop:map-cycle');
    expect(screenSource).not.toContain('showSelectedCallout=');
  });

  it("releases a drag by velocity into a spring settle, then hands the position back to the snap classes", () => {
    const releaseHandler = sheetSource.match(/const finishGesture[\s\S]*?\n  };/)?.[0] ?? "";
    expect(releaseHandler).toContain("resolveReleaseSnap({ offsets: so, position: g.position, velocity })");
    expect(releaseHandler).toContain("settleTo(target, so[target], g.position, velocity)");
    expect(releaseHandler).not.toContain("setOffset(");

    const commit = sheetSource.match(/const commitSnap[\s\S]*?\n  };/)?.[0] ?? "";
    expect(commit).toContain("setOffset(null)");
    expect(commit).toContain("setSnap(target)");
    expect(commit).toContain("setDragging(false)");

    // The settle is a spring that inherits the release velocity — not a fixed-duration transition.
    expect(sheetSource).toContain("springKeyframes({ from, to, velocity })");
    expect(sheetSource).toContain('easing: "linear", fill: "forwards"');
    expect(sheetSource).toContain('"(prefers-reduced-motion: reduce)"');
  });

  it("drags from anywhere on the sheet without stealing taps or the body's scroll", () => {
    // The whole sheet listens; the handle keeps only its click/keyboard affordance.
    expect(sheetSource).toContain("onPointerDown={onSheetPointerDown}");
    expect(sheetSource).toContain("onClickCapture={onSheetClickCapture}");
    expect(sheetSource).not.toContain("onPointerDown={onPointerDown}");
    // A drag is confirmed only after slop, and only then captures the pointer.
    expect(sheetSource).toContain("if (Math.abs(dy) < DRAG_SLOP) return;");
    expect(sheetSource).toContain("el.setPointerCapture(e.pointerId)");
    // Scroll vs sheet: pull down from the top, or lift a sheet whose content cannot scroll.
    expect(sheetSource).toContain("|| (dy > 0 && atTop)");
    expect(sheetSource).toContain('|| (dy < 0 && snap !== "full" && (!canScroll || selectedPlace !== null))');
    // Native scroll is held off only while the sheet owns the touch.
    expect(sheetSource).toContain('el.addEventListener("touchmove", onTouchMove, { passive: false })');
    expect(sheetSource).toContain("rubberBand(g.startOffset + (e.clientY - g.y0), g.min, g.max, g.dimension)");
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

  it("lets half-sheet photos consume the visible space above the action bar", () => {
    expect(styles).toContain("--selected-action-bar-height:");
    expect(styles).toContain(".mapsheet.half.has-selection .mapsheet-detail-body {");
    expect(styles).toContain("flex-basis: calc(48% - 44px - var(--selected-action-bar-height));");
    expect(styles).toContain(".mapsheet.half.has-selection .selected-place-summary.half {");
    expect(styles).toContain("flex: 1;");
    expect(styles).toContain(".mapsheet.half.has-selection .selected-place-summary-media-rail {");
    expect(styles).toContain("min-height: 0;");
    expect(styles).toContain("height: auto;");
  });

  it("anchors photos to the flex-sized half-sheet tiles", () => {
    const tileRule = styles.match(
      /\.selected-place-summary-media-rail > \.selected-place-summary-media \{([\s\S]*?)\}/,
    )?.[1] ?? "";
    const imageRule = styles.match(
      /\.selected-place-summary-media-rail > \.selected-place-summary-media img \{([\s\S]*?)\}/,
    )?.[1] ?? "";

    expect(tileRule).toContain("position: relative;");
    expect(imageRule).toContain("position: absolute;");
    expect(imageRule).toContain("inset: 0;");
  });

  it("caps the half-sheet photo rail at the full-detail collage height", () => {
    const halfRailRule = styles.match(
      /\.mapsheet\.half\.has-selection \.selected-place-summary-media-rail \{([\s\S]*?)\}/,
    )?.[1] ?? "";

    expect(halfRailRule).toContain("max-height: 170px;");
  });
});

describe("place photo ingestion", () => {
  it("attaches generated photos to places without touching each import", () => {
    const data = readFileSync(new URL("../lib/data.ts", import.meta.url), "utf8");
    expect(data).toContain("PLACE_PHOTOS[p.id]");
    expect(data).toContain("PLACE_PHOTO_THUMBNAILS[p.id]");
    expect(data).toContain("photoThumbnail?: string");
    // a place with no photo must stay undefined, not become an empty array,
    // so the sheet falls to the honest empty state
    expect(data).toContain("PLACE_PHOTOS[p.id]?.length ?");
  });

  it("ships no placeholder photos — the empty state is the truth today", async () => {
    const { PLACE_PHOTOS } = await import("./generated/place-photos");
    for (const [id, list] of Object.entries(PLACE_PHOTOS)) {
      expect(list.length, id).toBeGreaterThan(0);
      for (const src of list) expect(src.startsWith("/places/"), src).toBe(true);
    }
  });

  it("uses dedicated small thumbnails for map rows and defers their decoding offscreen", () => {
    const sheet = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");
    expect(sheet).toContain("const placePhoto = place.photoThumbnail ?? place.photos?.[0] ?? place.photoUrl");
    expect(sheet).toContain('loading="lazy"');
    expect(sheet).toContain('decoding="async"');
    expect(sheet).toContain("width={84}");
    expect(sheet).toContain("height={84}");
  });

  it("loads only the initially visible selected-place photos eagerly", () => {
    const summary = readFileSync(new URL("../components/map/selected-place-summary.tsx", import.meta.url), "utf8");
    expect(summary).toContain('loading={i < 2 ? "eager" : "lazy"}');
    expect(summary).toContain('decoding="async"');
  });

  it("renders real place photos in both the detail hero and Photos section", () => {
    const detail = readFileSync(new URL("../components/place/place-detail-body.tsx", import.meta.url), "utf8");
    expect(detail).toContain("function PlacePhotoCollage");
    expect(detail).toContain("photos.slice(0, 3)");
    expect(detail).toContain("<PlacePhotoCollage photos={place.photos ?? []}");
    expect(detail).toContain("<PhotosSection place={place}");
  });
});

describe("an explicit selection always renders", () => {
  it("resolves the selected place from the catalog, not the filtered list", () => {
    // Tapping a hair salon in the station browse while the map filter was on
    // Olive Young dropped the selection silently and fell back to the generic
    // nearby list (owner report 2026-08-23).
    const sheet = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");
    expect(sheet).toContain("getPlace(selectedId)");
  });
});
