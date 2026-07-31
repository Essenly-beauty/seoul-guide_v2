import { Icon } from "@/components/icon";
import { OY_BRAND_GREEN, TYPE_COLOR, TYPE_ICON, type PlaceType } from "@/lib/data";

/** Colored rounded square + white category glyph (spec v2 §3.1).
    One visual language across filter chips, map pins, search rows, and rankings.
    Olive Young gets its brand mark (white OY on the brand lime) instead of the
    generic bag glyph — the tile users already know from Kakao/Naver maps. */
export function CategoryBadge({ type, size = 18 }: { type: PlaceType; size?: number }) {
  if (type === "olive_young") {
    return (
      <span
        className="catbadge"
        style={{ width: size, height: size, background: OY_BRAND_GREEN }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" style={{ width: size * 0.95, height: size * 0.95 }}>
          <text x="12" y="16.4" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#fff" fontFamily="inherit" letterSpacing="-0.5">OY</text>
        </svg>
      </span>
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
