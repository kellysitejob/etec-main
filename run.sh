#!/usr/bin/env bash
cd "$(dirname "$0")"

if command -v py >/dev/null 2>&1; then
  PY=py
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

"$PY" -m http.server 8765 &
pid=$!
sleep 1

url="http://127.0.0.1:8765"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url"
elif command -v open >/dev/null 2>&1; then
  open "$url"
else
  cmd.exe /c start "" "$url"
fi

wait "$pid"
