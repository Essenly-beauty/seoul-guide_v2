import { Icon } from "@/components/icon";
import { TYPE_COLOR, TYPE_ICON, type PlaceType } from "@/lib/data";

/** Colored rounded square + white category glyph (spec v2 §3.1).
    One visual language across filter chips, map pins, search rows, and rankings. */
export function CategoryBadge({ type, size = 18 }: { type: PlaceType; size?: number }) {
  return (
    <span
      className="catbadge"
      style={{ width: size, height: size, background: TYPE_COLOR[type] }}
      aria-hidden="true"
    >
      <Icon name={TYPE_ICON[type]} style={{ width: Math.round(size * 0.62), height: Math.round(size * 0.62) }} />
    </span>
  );
}
