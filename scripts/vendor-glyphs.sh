#!/usr/bin/env bash
# Copies the basemap label fonts into public/fonts/ so the site depends on
# nothing outside this repository.
#
# Optional: by default the map loads glyphs from the Protomaps asset set,
# which is free and openly licensed. Run this if you would rather serve
# them yourself — then set NUXT_PUBLIC_GLYPHS_URL=/fonts.
set -euo pipefail

DEST="${DEST:-public/fonts}"
command -v git >/dev/null || { echo "git required"; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Fetching Protomaps basemap assets …"
git clone --depth 1 https://github.com/protomaps/basemaps-assets "$tmp/assets"

mkdir -p "$DEST"
cp -r "$tmp/assets/fonts/." "$DEST/"

echo "Done: $DEST ($(du -sh "$DEST" | cut -f1))"
echo "Now set NUXT_PUBLIC_GLYPHS_URL=/fonts"
echo "Note: these count against the ~1GB GitHub Pages repo budget."
