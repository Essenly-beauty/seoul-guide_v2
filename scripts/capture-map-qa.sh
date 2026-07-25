#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
URL="${URL:-http://127.0.0.1:3000/map}"
OUT_DIR="${OUT_DIR:-/tmp/essenly-map-qa}"
SETTLE_SECONDS="${SETTLE_SECONDS:-1}"

settle() {
  sleep "$SETTLE_SECONDS"
}

if [[ -n "${BROWSE_BIN:-}" ]]; then
  B="$BROWSE_BIN"
elif [[ -x "$HOME/.agents/skills/gstack/browse/dist/browse" ]]; then
  B="$HOME/.agents/skills/gstack/browse/dist/browse"
elif [[ -x "$HOME/.Codex/skills/gstack/browse/dist/browse" ]]; then
  B="$HOME/.Codex/skills/gstack/browse/dist/browse"
else
  echo "gstack browse is not installed."
  exit 1
fi

if ! curl --silent --fail --max-time 3 "$URL" >/dev/null; then
  echo "Essenly is not responding at $URL"
  exit 1
fi

mkdir -p "$OUT_DIR"
cd "$PROJECT_DIR"

echo "Capturing Essenly map states to $OUT_DIR"

"$B" goto "$URL"
"$B" viewport 390x844
"$B" wait ".map-screen"
settle
"$B" screenshot "$OUT_DIR/01-map-peek.png"

"$B" click ".mapsheet-handle"
"$B" wait ".mapsheet.half"
settle
"$B" screenshot "$OUT_DIR/02-map-list.png"

"$B" click ".mapsheet-body .maprow:first-of-type"
"$B" wait ".map-place-callout"
settle
"$B" screenshot "$OUT_DIR/03-map-place-selected.png"

"$B" click ".map-place-callout-close"
"$B" wait ".mapsheet:not(.selected)"
"$B" click ".map-modebtn"
"$B" wait ".subway-controller"
settle
"$B" screenshot "$OUT_DIR/04-subway-search.png"

"$B" fill ".subway-search-field-stack .station-combobox:first-of-type input" "Gangnam"
"$B" wait ".subway-search-field-stack .station-combobox:first-of-type .station-search-results"
"$B" screenshot "$OUT_DIR/05-subway-departure-results.png"
"$B" click ".subway-search-field-stack .station-combobox:first-of-type [role='option']:first-of-type"

"$B" fill ".subway-search-field-stack .station-combobox:nth-of-type(2) input" "Myeongdong"
"$B" wait ".subway-search-field-stack .station-combobox:nth-of-type(2) .station-search-results"
"$B" screenshot "$OUT_DIR/06-subway-arrival-results.png"
"$B" click ".subway-search-field-stack .station-combobox:nth-of-type(2) [role='option']:first-of-type"

settle
"$B" screenshot "$OUT_DIR/07-subway-route-ready.png"
"$B" click ".subway-search-footer .btn:not(.ghost)"
"$B" wait ".subway-route-summary"
settle
"$B" screenshot "$OUT_DIR/08-subway-route-half.png"

"$B" click ".subway-snap-handle"
"$B" wait ".subway-controller.snap-full"
settle
"$B" screenshot "$OUT_DIR/09-subway-route-full.png"

"$B" console --errors >"$OUT_DIR/console.txt"
"$B" network >"$OUT_DIR/network.txt"

echo "Capture complete."
printf '%s\n' "$OUT_DIR"/*.png
