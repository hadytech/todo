#!/usr/bin/env bash
# Phase 0 blocker check: does GitHub Pages honour HTTP Range requests?
#
# PMTiles works by fetching byte ranges out of one large archive. If Pages
# ignores Range and returns 200 with the whole file, every map view would
# download the entire archive and the map plan has to change.
#
# Usage: scripts/check-pages-range.sh https://<user>.github.io/<repo>/tiles/toshkent.pmtiles
set -euo pipefail
URL="${1:?usage: check-pages-range.sh <url-to-a-pages-hosted-file>}"

echo "Checking: $URL"
headers=$(curl -sSL -D- -o /dev/null -r 0-255 --max-time 30 "$URL")

status=$(printf '%s' "$headers" | grep -iE '^HTTP/' | tail -1)
echo "  status:        $status"
echo "  accept-ranges: $(printf '%s' "$headers" | grep -i '^accept-ranges:' || echo '(absent)')"
echo "  content-range: $(printf '%s' "$headers" | grep -i '^content-range:' || echo '(absent)')"

if printf '%s' "$status" | grep -q '206'; then
  echo "PASS — Pages honours Range. Serve the .pmtiles archive from public/tiles/."
else
  echo "FAIL — no 206. Host the archive as a GitHub Release asset instead and"
  echo "       set NUXT_PUBLIC_PMTILES_URL to it. Verify CORS from the Pages origin."
  exit 1
fi
