export type MapSize = { width: number; height: number };
export type MapInsets = { top?: number; right?: number; bottom?: number; left?: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pixel anchor inside the map area not covered by UI. `yBias` shifts the
    anchor down the visible band (0.5 = center) — e.g. 0.62 leaves headroom
    for a callout card that opens above the pin. */
export function visibleMapAnchor(size: MapSize, insets: MapInsets, yBias = 0.5) {
  const width = Math.max(0, size.width);
  const height = Math.max(0, size.height);
  const top = clamp(insets.top ?? 0, 0, height);
  const bottom = clamp(insets.bottom ?? 0, 0, height - top);
  const left = clamp(insets.left ?? 0, 0, width);
  const right = clamp(insets.right ?? 0, 0, width - left);

  const clampedBias = clamp(yBias, 0, 1);
  return {
    x: left + (width - left - right) / 2,
    y: top + (height - top - bottom) * clampedBias,
  };
}
