#!/usr/bin/env bash
# Builds the Tashkent basemap archive: public/tiles/toshkent.pmtiles
#
# Extracts a city-sized slice out of the Protomaps daily planet build.
# This is far cheaper than running planetiler yourself, and the result is
# a single file served straight from GitHub Pages with no tile server,
# no API key and no per-request cost.
#
# Prerequisite: the pmtiles CLI —
#   https://github.com/protomaps/go-pmtiles/releases
#
# The archive is gitignored: at tens of MB it would eat the ~1GB Pages
# repo budget. Build it locally, or attach it to a GitHub Release and
# point NUXT_PUBLIC_PMTILES_URL at that instead.
set -euo pipefail

# Toshkent bounding box — matches the coordinate validation in lib/schema.ts.
BBOX="${BBOX:-69.10,41.15,69.55,41.45}"
OUT="${OUT:-public/tiles/toshkent.pmtiles}"

# Protomaps publishes a dated planet build. Pick a recent weekday; there
# is no "latest" alias, so this is deliberately explicit.
BUILD="${BUILD:-}"
if [[ -z "$BUILD" ]]; then
  echo "Set BUILD to a dated Protomaps planet build, e.g."
  echo "  BUILD=20260901 scripts/build-tiles.sh"
  echo "Available builds are listed at https://maps.protomaps.com/builds/"
  exit 1
fi

command -v pmtiles >/dev/null || {
  echo "pmtiles CLI not found — https://github.com/protomaps/go-pmtiles/releases"
  exit 1
}

mkdir -p "$(dirname "$OUT")"
echo "Extracting $BBOX from build $BUILD …"
pmtiles extract "https://build.protomaps.com/${BUILD}.pmtiles" "$OUT" --bbox="$BBOX"

echo
echo "Done: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Serve it locally with 'npm run dev', or upload it to a GitHub Release"
echo "and set NUXT_PUBLIC_PMTILES_URL to that asset's URL."
