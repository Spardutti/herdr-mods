#!/usr/bin/env bash
interval=${HERDR_WATCH_INTERVAL:-60}
misses=0

while true; do
  # A failed check means "don't know": only a clean answer without the app counts as closed.
  if listing=$(tasklist.exe /FI "IMAGENAME eq herdr-app.exe" /NH 2>/dev/null); then
    if grep -qi '^herdr-app\.exe' <<< "$listing"; then
      misses=0
    else
      misses=$((misses + 1))
    fi
  fi
  if [ "$misses" -ge 2 ]; then
    # Herdr's Windows core outlives the app and would boot WSL again within seconds.
    taskkill.exe /F /IM herdr-core.exe >/dev/null 2>&1
    exec wsl.exe --shutdown
  fi
  sleep "$interval"
done
