"use client";

// Design-system Switch (docs/design-system.md §3) — the role="switch"
// track/thumb toggle from mypage/notifications-form.tsx. Visible row text
// stays with the caller; pass `label` (accessible name) and optionally
// `describedBy` pointing at the caption element's id.
type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name (aria-label) — required unless labelled elsewhere. */
  label?: string;
  /** id of the element describing the switch (aria-describedby). */
  describedBy?: string;
};

export function Switch({ checked, onChange, label, describedBy }: SwitchProps) {
  return (
    <button
      type="button"
      className="notification-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
    >
      <span className="notification-switch-track" aria-hidden="true">
        <span className="notification-switch-thumb" />
      </span>
    </button>
  );
}
