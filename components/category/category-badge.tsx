import { Icon } from "@/components/icon";
import { BRAND_MARK_SRC, TYPE_COLOR, TYPE_ICON, type PlaceType } from "@/lib/data";

/** Shared retailer artwork and semantic category glyphs for compact UI. */
export function CategoryBadge({ type, size = 18 }: { type: PlaceType; size?: number }) {
  const brandMark = BRAND_MARK_SRC[type];
  if (brandMark) {
    return (
      // Owner-provided, same-origin retailer artwork.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brandMark}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, flex: "none", objectFit: "contain", borderRadius: 4, background: "#fff" }}
      />
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
