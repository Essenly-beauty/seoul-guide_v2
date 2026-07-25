#!/bin/zsh

set -u

PROJECT_DIR="${0:A:h}"
PORT="${PORT:-3000}"
URL="http://127.0.0.1:${PORT}/map"

cd "$PROJECT_DIR" || exit 1

LISTENER_PID="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1)"

# The page HTML can return 200 while its JS chunks 404 (stale .next after
# file renames/deletes). Healthy means the page AND a referenced chunk load.
is_healthy() {
  local html assets asset
  html="$(curl --silent --fail --max-time 2 "$URL" 2>/dev/null)" || return 1
  assets="$(printf '%s' "$html" | grep -oE '/_next/static/[^"]+\.js' | sort -u | head -n 5)"
  [[ -z "$assets" ]] && return 1
  while IFS= read -r asset; do
    curl --silent --fail --max-time 2 "http://127.0.0.1:${PORT}${asset}" >/dev/null 2>&1 || return 1
  done <<<"$assets"
  return 0
}

if [[ -n "$LISTENER_PID" ]]; then
  if is_healthy; then
    open "$URL"
    exit 0
  fi

  LISTENER_CWD="$(lsof -a -p "$LISTENER_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  if [[ "$LISTENER_CWD" != "$PROJECT_DIR" ]]; then
    echo "Port $PORT is used by another project: ${LISTENER_CWD:-unknown}"
    exit 1
  fi

  echo "Restarting an unhealthy Essenly server on port $PORT"
  kill "$LISTENER_PID" || exit 1
  for _ in {1..30}; do
    if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done

  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "The previous server did not stop cleanly."
    exit 1
  fi

fi

# A running build can leave Next.js chunk references out of sync.
# This directory only contains generated output and is rebuilt on startup.
rm -rf "$PROJECT_DIR/.next"

echo "Starting Essenly at $URL"
LOG_FILE="/tmp/essenly-dev-${PORT}.log"
nohup npm run dev -- --hostname 127.0.0.1 --port "$PORT" >"$LOG_FILE" 2>&1 </dev/null &
SERVER_PID=$!

for _ in {1..60}; do
  if is_healthy; then
    open "$URL"
    echo "Essenly is running (PID $SERVER_PID)."
    echo "Log: $LOG_FILE"
    exit 0
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "Essenly failed to start."
    tail -n 80 "$LOG_FILE"
    exit 1
  fi
  sleep 0.5
done

echo "Server did not become ready at $URL"
tail -n 80 "$LOG_FILE"
kill "$SERVER_PID" >/dev/null 2>&1 || true
exit 1
