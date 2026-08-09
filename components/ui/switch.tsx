"use client";

// Design-system Switch (docs/design-system.md §3) — the role="switch"
// track/thumb toggle from mypage/notifications-form.tsx. Visible row text
// stays with the caller; pass `label` (accessible name) and optionally
// `describedBy` pointing at the caption element's id.
type AccessibleName =
  | { label: string; labelledBy?: never }
  | { label?: never; labelledBy: string };

type SwitchProps = AccessibleName & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** id of the element labelling the switch (aria-labelledby). */
  labelledBy?: string;
  /** id of the element describing the switch (aria-describedby). */
  describedBy?: string;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, labelledBy, describedBy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      className="notification-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="notification-switch-track" aria-hidden="true">
        <span className="notification-switch-thumb" />
      </span>
    </button>
  );
}
