export type MapSheetSnap = "peek" | "half" | "full";

export type SelectedPlaceView = "compact" | "summary" | "detail";

export function resolveSelectedPlaceView(snap: MapSheetSnap): SelectedPlaceView {
  if (snap === "peek") return "compact";
  if (snap === "half") return "summary";
  return "detail";
}

export function nextMapSheetSnap(snap: MapSheetSnap): MapSheetSnap {
  if (snap === "half") return "full";
  if (snap === "full") return "peek";
  return "half";
}

export function getMapSheetHalfOffsetRatio(hasSelection: boolean): number {
  return hasSelection ? 0.52 : 0.42;
}
