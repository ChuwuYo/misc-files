#!/usr/bin/env bash
# Simple foreground loop: pull every 15 minutes.
# Stop with Ctrl-C.
cd "$(dirname "$0")"
INTERVAL="${INTERVAL:-900}"
while true; do
  python3 update.py
  echo "--- next pull in ${INTERVAL}s ---"
  sleep "$INTERVAL"
done
