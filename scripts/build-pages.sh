#!/usr/bin/env bash
# Builds the live web app (connected to the Cooperstown database) for GitHub Pages:
#   https://utproducts.github.io/Cooperstown-experience/
# Usage: scripts/build-pages.sh [outDir]   (default: dist-pages)
set -euo pipefail
OUT="${1:-dist-pages}"
rm -rf "$OUT"
EXPO_BASE_URL=/Cooperstown-experience \
EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://lkyrieejwifdbnhzcrul.supabase.co}" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_4ZAKw7jmc8gebwXpPk468A_-NyxIz56}" \
EXPO_PUBLIC_APP_URL="https://utproducts.github.io/Cooperstown-experience" \
  npx expo export -p web --output-dir "$OUT"
# Any path (e.g. /fan/schedule) loads the app, which then routes it.
cp "$OUT/index.html" "$OUT/404.html"
# Don't let Pages' Jekyll step drop the _expo folder.
touch "$OUT/.nojekyll"
echo "Built $OUT for GitHub Pages"
