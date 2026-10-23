# Shared place-data fill-only contract

Both A Drop of Seoul and My Seoul Drop use contract `seoul-place-fill-only-v1` from `data/place-data-fill-policy.json`.

## Required behavior

- Keep every non-empty service value unchanged. Imports may fill an empty field but may not replace an existing value without explicit, place-specific owner approval.
- Keep service-native IDs unchanged and join the services through permanent `common_id` values from the central registry.
- Keep existing photo files and their display order. Deduplicate candidates, then append only enough reviewed photos to fill the 3–5 photo target.
- Retailer logos and brand hero artwork are UI fallbacks, not place photos.
- A record missing from a newer source becomes a tombstone. Never reuse its `common_id` or silently delete its photo history.

The canonical registry and photo manifest live in Google Drive folder `1s5QAEJVrh7IDvcLfeFX1JqoYUXZRS36M`. Repository copies are projections for each service, not permission to overwrite existing service data.
