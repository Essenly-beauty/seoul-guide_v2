#!/bin/zsh
# Capture Seoul Olive Young stores from Kakao Map's public search results.
# Requires the gstack browse daemon (~/.claude/skills/gstack/browse/dist/browse).
#
#   ./scripts/capture-kakao-oy.sh          # writes scripts/.kakao-oy-stores.json
#   node scripts/build-oliveyoung-kakao.mjs  # then geocode + generate
#
# Kakao caps each search at 3 pages × 15 results, so we shard by the 25 Seoul
# districts ("서울 {구} 올리브영") — no district has >45 stores today. The
# full pagination only unlocks after clicking "장소 더보기".

set -u
DIR="${0:A:h}"
B="${BROWSE_BIN:-$HOME/.claude/skills/gstack/browse/dist/browse}"
TMP="$(mktemp -d)"
OUT="$TMP/pages.jsonl"

cat > "$TMP/extract.js" <<'EOF'
JSON.stringify(Array.from(document.querySelectorAll('#info\\.search\\.place\\.list > li.PlaceItem')).map(li => ({
  name: li.querySelector('.link_name')?.textContent.trim(),
  addr: li.querySelector('.addr [data-id=address], .addr p')?.textContent.trim(),
  score: li.querySelector('.rating .score em, [data-id=scoreNum]')?.textContent.trim() ?? null,
  reviews: li.querySelector('[data-id=numberofreview], a.review em, .review em')?.textContent.trim() ?? null,
})))
EOF

"$B" stop 2>/dev/null; sleep 1
for GU in 강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구; do
  Q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('서울 $GU 올리브영'))")
  "$B" goto "https://map.kakao.com/?q=$Q" >/dev/null 2>&1
  sleep 3
  "$B" js "document.querySelector('#info\\\\.search\\\\.place\\\\.more')?.click(); 'more'" >/dev/null 2>&1
  sleep 2
  for pg in 1 2 3; do
    if [ "$pg" != "1" ]; then
      "$B" js "document.querySelector('#info\\\\.search\\\\.page\\\\.no$pg')?.click(); 'p'" >/dev/null 2>&1
      sleep 2
    fi
    echo "{\"gu\": \"$GU\", \"items\": $("$B" eval "$TMP/extract.js" 2>/dev/null | tail -1)}" >> "$OUT"
  done
  echo "captured $GU"
done
"$B" stop 2>/dev/null || true

python3 - "$OUT" "$DIR/.kakao-oy-stores.json" <<'EOF'
import json, sys
seen = {}
for line in open(sys.argv[1]):
    try: rec = json.loads(line)
    except: continue
    for x in (rec.get("items") or []):
        if x.get("name") and x.get("addr"): seen[(x["name"], x["addr"])] = x
seoul = [x for x in seen.values() if x["addr"].startswith("서울")]
json.dump(seoul, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(f"wrote {sys.argv[2]}: {len(seoul)} Seoul stores")
EOF
