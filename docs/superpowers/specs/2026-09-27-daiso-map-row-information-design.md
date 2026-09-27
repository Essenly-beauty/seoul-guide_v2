# Daiso map-row information, 2026-09-27

## Decision

The owner approved the information-focused Daiso row proposed after reviewing the current card and the Kakao Map reference. Keep the supplied Daiso logo and the existing English-primary/Korean-secondary store names. Remove the redundant `DAISO · <area>` eyebrow and the same-for-every-store `₩` marker from Daiso rows only. Preserve the existing open/closed status and distance. Below those, show `Tax refund` and/or `SIM card` only when that specific store has the corresponding official `serviceTags` value. Do not infer a missing service, rating, review count, or price.

## Scope and alternatives

- Chosen: remove duplicate information and add only store-specific service facts. This improves the scan value of a Daiso result without claiming nonexistent ratings.
- Smaller alternative: remove eyebrow and price only. It is simpler but hides two useful existing store facts in detail.
- Deferred alternative: copy Kakao's rating/review/location-heavy row. App data has no Daiso ratings, and the area is often repeated in the store name.

Apply the chosen layout to both ordinary nearby rows and the same-coordinate choice list. Do not change other place categories, product ranking, store data, or the selected-place detail sheet. Existing verified photos still take precedence over the logo.

## Data and states

Read `Place.serviceTags` already present in the catalog. `tax-refund` maps to `Tax refund`; `sim-card` maps to `SIM card`. Render no service line when neither is present. A missing opening schedule retains the existing `Hours unknown` state; this change does not invent hours. Labels are text, not color-only indicators, and remain part of the row's button name for assistive technology.

## Verification

Cover Daiso with both tags, one tag, and neither; confirm a non-Daiso row keeps its category/area and price. Confirm both map-row variants use the same facts. Run focused tests, full tests, type check, lint, production build, and inspect the isolated Vercel preview at a mobile-width card. Production release remains subject to the separate Supabase migration/access gate.
