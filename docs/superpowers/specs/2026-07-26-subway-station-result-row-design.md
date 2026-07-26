# Subway Station Result Row Design

> Approved from the 2026-07-26 applied-image review.

## Goal

Make station search results read as one compact unit: line badges first, station name immediately after, and recent/nearby context visually quiet.

## Visual Contract

- Keep every route line visible for transfer stations.
- Render line badges at 20px height with content-width padding; one-character lines remain circular and longer abbreviations become compact pills.
- Use a 6px gap between the line-badge group and station text.
- Use the English station name as the primary 14px label and the Korean name as a muted 12px secondary label.
- Keep each result at least 56px tall so the full row remains the touch target.
- Replace repeated visible `Recent` and `Near you` text with a small muted history/location icon at the trailing edge.
- Keep `Recent` and `Near you` in the option's accessible name through visually hidden text.
- Preserve active, selected, hover, keyboard focus, pointer selection, and combobox behavior.

## Responsive Contract

- The station text must truncate before the trailing status icon.
- Transfer badges must not shrink or wrap.
- On narrow mobile widths, longer line abbreviations may use their content width but must not force horizontal scrolling.

## Scope

Modify only the shared icon sprite, station-result markup, its CSS, and the station-search layout contract test. Do not change station search ranking, route calculation, recent-station storage, or other subway UI.
