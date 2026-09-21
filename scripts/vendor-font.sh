#!/usr/bin/env bash
# Vendors Manrope into public/fonts/ so the site depends on nothing
# external. Optional — by default the font comes from Google Fonts.
#
# Worth doing if you would rather not have a third-party request on every
# page load, or if Google Fonts is slow for your visitors. Manrope is
# SIL OFL licensed, so self-hosting is explicitly permitted.
set -euo pipefail
DEST="${DEST:-public/fonts}"
mkdir -p "$DEST"

echo "Fetching Manrope…"
curl -fsSL -o "$DEST/manrope.zip" \
  "https://github.com/sharanda/manrope/archive/refs/heads/master.zip"
unzip -qo "$DEST/manrope.zip" -d "$DEST/tmp"
find "$DEST/tmp" -name '*.woff2' -exec cp {} "$DEST/" \;
rm -rf "$DEST/tmp" "$DEST/manrope.zip"

cat <<'NOTE'

Done. Now:
  1. remove the Google Fonts <link> entries from nuxt.config.ts
  2. add @font-face rules pointing at /fonts/… in app/assets/css/main.css
     with font-display: swap
NOTE
