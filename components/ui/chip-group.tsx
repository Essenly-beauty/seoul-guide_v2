"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export type ChipItem = {
  label: string;
  /** Extra classes on the chip (e.g. "mono"). */
  className?: string;
  /** Trailing content such as a price (rendered after the label). */
  suffix?: React.ReactNode;
};

type ChipGroupProps = {
  items: (string | ChipItem)[];
  /** Single-select (radio) vs multi-select (toggle). */
  single?: boolean;
  /** Labels selected by default. */
  defaultSelected?: string[];
  /** Use the soft (tinted) selected style instead of solid. */
  soft?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Wrap chips (chipwrap) instead of a horizontal scroll row (chiprow). */
  wrap?: boolean;
  /** Leading label rendered before the chips (for filter rows). */
  lead?: React.ReactNode;
};

function normalize(item: string | ChipItem): ChipItem {
  return typeof item === "string" ? { label: item } : item;
}

export function ChipGroup({
  items,
  single,
  defaultSelected = [],
  soft,
  className,
  style,
  wrap = true,
  lead,
}: ChipGroupProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  function toggle(label: string) {
    setSelected((prev) => {
      if (single) return new Set([label]);
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const wrapCls = wrap ? "chipwrap" : "chiprow";
  return (
    <div className={[wrapCls, className].filter(Boolean).join(" ")} style={style}>
      {lead}
      {items.map(normalize).map((item, i) => {
        const on = selected.has(item.label);
        return (
          <button
            key={item.label + i}
            className={["chip", soft ? "soft" : "", item.className ?? "", on ? "selected" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={on}
            onClick={() => toggle(item.label)}
          >
            {item.label}
            {item.suffix}
          </button>
        );
      })}
    </div>
  );
}
