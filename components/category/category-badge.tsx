import { Icon } from "@/components/icon";
import { TYPE_COLOR, TYPE_ICON, type PlaceType } from "@/lib/data";

/** Colored rounded square + white category glyph (spec v2 §3.1).
    One visual language across filter chips, map pins, search rows, and
    rankings. Olive Young always draws its olive logo mark (lime O + red
    drupe on a light disc), never the "OY" letters (user decision 2026-08-02). */
export function CategoryBadge({ type, size = 18 }: { type: PlaceType; size?: number }) {
  if (type === "olive_young") {
    return (
      <svg viewBox="0 0 24 24" style={{ width: size, height: size, flex: "none" }} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="rgba(15, 23, 42, 0.16)" strokeWidth="1" />
        <ellipse cx="12" cy="12.6" rx="5" ry="6.2" fill="none" stroke="#9bce26" strokeWidth="2.6" transform="rotate(16 12 12.6)" />
        <ellipse cx="14.1" cy="7.4" rx="1.7" ry="2.1" fill="#e0716e" transform="rotate(20 14.1 7.4)" />
      </svg>
    );
  }
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
