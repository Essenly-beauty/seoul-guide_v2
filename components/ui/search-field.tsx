"use client";

import type { CSSProperties, Ref } from "react";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";

// Design-system SearchField (docs/design-system.md §3) — the
// `.mobile-search-field` pill used by /search and the ranking BrandsPanel:
// leading search glyph + borderless input + clear button while non-empty.
type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Required — the pill has no visible label, so the input must announce itself. */
  label: string;
  /** Shows the clear IconButton while `value` is non-empty. */
  onClear?: () => void;
  autoFocus?: boolean;
  /** For focus management from the caller (e.g. refocus after clear). */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  style?: CSSProperties;
};

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  onClear,
  autoFocus,
  inputRef,
  className,
  style,
}: SearchFieldProps) {
  const cls = ["mobile-search-field", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style}>
      <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
      <input
        ref={inputRef}
        className="small"
        // 16px font keeps iOS from zooming the viewport on focus.
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16 }}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {onClear && value && (
        <IconButton name="x" label="Clear search" iconSize="xs" onClick={onClear} />
      )}
    </div>
  );
}
