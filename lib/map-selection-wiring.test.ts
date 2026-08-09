import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screenSource = readFileSync(new URL("../components/map/map-screen.tsx", import.meta.url), "utf8");
const sheetSource = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");
const viewSource = readFileSync(new URL("../components/map/map-view.tsx", import.meta.url), "utf8");

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

  it("keeps the sheet snap on selection and renders a large map callout", () => {
    expect(sheetSource).toContain("`mapsheet ${snap}${dragging");
    expect(sheetSource).not.toContain('"selected peek"');
    expect(viewSource).toContain("<SelectedPlaceCallout");
    expect(viewSource).toContain("closeOnEscapeKey={false}");
  });

  it("moves focus into the selected callout and restores a stable list control", () => {
    expect(viewSource).toContain("closeRef.current?.focus({ preventScroll: true })");
    expect(viewSource).toContain("ref={closeRef}");
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
});
