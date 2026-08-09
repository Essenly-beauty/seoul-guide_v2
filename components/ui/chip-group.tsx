"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Chip } from "@/components/ui/chip";

export type ChipItem = {
  label: string;
  /** Extra classes on the chip (e.g. "mono"). */
  className?: string;
  /** Trailing content such as a price (rendered after the label). */
  suffix?: React.ReactNode;
};

type ChipGroupProps = {
  items: (string | ChipItem)[];
  /** Accessible name for the choice group. */
  ariaLabel: string;
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
  ariaLabel,
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

  function onRadioKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!single) return;
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    const nextItem = normalize(items[next]);
    setSelected(new Set([nextItem.label]));
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  const wrapCls = wrap ? "chipwrap" : "chiprow";
  return (
    <div
      className={[wrapCls, className].filter(Boolean).join(" ")}
      style={style}
      role={single ? "radiogroup" : "group"}
      aria-label={ariaLabel}
    >
      {lead}
      {items.map(normalize).map((item, i) => {
        const on = selected.has(item.label);
        return (
          <Chip
            key={item.label + i}
            className={item.className}
            selected={on}
            soft={soft}
            role={single ? "radio" : undefined}
            aria-checked={single ? on : undefined}
            tabIndex={single ? (on || (selected.size === 0 && i === 0) ? 0 : -1) : undefined}
            onClick={() => toggle(item.label)}
            onKeyDown={(event) => onRadioKeyDown(event, i)}
          >
            {item.label}
            {item.suffix}
          </Chip>
        );
      })}
    </div>
  );
}
