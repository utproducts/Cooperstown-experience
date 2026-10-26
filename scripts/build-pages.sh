#!/usr/bin/env bash
# Builds the site for GitHub Pages (https://utproducts.github.io/Cooperstown-experience/):
#   /       the live app, on the Cooperstown database (publishable key)
#   /demo/  the full demo on sample data, with the parent/director switch
# Usage: scripts/build-pages.sh [outDir]   (default: dist-pages)
set -euo pipefail
OUT="${1:-dist-pages}"
SITE=https://utproducts.github.io/Cooperstown-experience
DEMO_TMP="$(mktemp -d)"
rm -rf "$OUT"

EXPO_BASE_URL=/Cooperstown-experience \
EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://lkyrieejwifdbnhzcrul.supabase.co}" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_4ZAKw7jmc8gebwXpPk468A_-NyxIz56}" \
EXPO_PUBLIC_APP_URL="$SITE" \
EXPO_PUBLIC_DEMO_URL="$SITE/demo/" \
EXPO_PUBLIC_ZXING_WASM_PATH=/Cooperstown-experience/zxing_reader.wasm \
  npx expo export -p web --output-dir "$OUT"

# Empty database settings: the demo runs on its built-in sample data.
EXPO_BASE_URL=/Cooperstown-experience/demo \
EXPO_PUBLIC_SUPABASE_URL= \
EXPO_PUBLIC_SUPABASE_ANON_KEY= \
EXPO_PUBLIC_APP_URL="$SITE/demo" \
EXPO_PUBLIC_DEMO_URL= \
EXPO_PUBLIC_ZXING_WASM_PATH=/Cooperstown-experience/zxing_reader.wasm \
  npx expo export -p web --output-dir "$DEMO_TMP" --clear
mv "$DEMO_TMP" "$OUT/demo"

# Add to Home Screen: each app gets a manifest and icons, and opens full screen like an app (no browser bars).
installable() { # dir, base path, name, short name
  local dir="$1" base="$2"
  cp assets/pwa/icon-180.png "$dir/apple-touch-icon.png"
  cp assets/pwa/icon-192.png assets/pwa/icon-512.png "$dir/"
  cat > "$dir/manifest.webmanifest" <<JSON
{
  "name": "$3",
  "short_name": "$4",
  "start_url": "$base/",
  "scope": "$base/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFFFFF",
  "theme_color": "#0E2340",
  "icons": [
    { "src": "$base/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "$base/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "$base/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
JSON
  local tags="<link rel=\"manifest\" href=\"$base/manifest.webmanifest\"/><link rel=\"apple-touch-icon\" href=\"$base/apple-touch-icon.png\"/><meta name=\"apple-mobile-web-app-capable\" content=\"yes\"/><meta name=\"mobile-web-app-capable\" content=\"yes\"/><meta name=\"apple-mobile-web-app-title\" content=\"$4\"/><meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\"/>"
  sed -i "s|</head>|$tags</head>|; s|shrink-to-fit=no\"|shrink-to-fit=no, viewport-fit=cover\"|" "$dir/index.html"
}
installable "$OUT" /Cooperstown-experience "Cooperstown All Star Village" "All Star Village"
installable "$OUT/demo" /Cooperstown-experience/demo "All Star Village (demo)" "ASV Demo"

cp "$OUT/index.html" "$OUT/live.html"
# The QR reader for browsers without a built-in one (see src/components/qr-scanner.web.tsx).
cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm "$OUT/zxing_reader.wasm"
cp "$OUT/demo/index.html" "$OUT/demo/app.html"

# Pages serves one 404.html for every unknown path (deep links like /fan/schedule). It loads whichever app the path
# belongs to, which then routes it.
cat > "$OUT/404.html" <<'HTML'
<!doctype html><meta charset="utf-8"><title>Cooperstown Experience</title>
<script>
  var demo = location.pathname.indexOf('/Cooperstown-experience/demo') === 0;
  fetch(demo ? '/Cooperstown-experience/demo/app.html' : '/Cooperstown-experience/live.html')
    .then(function (r) { return r.text(); })
    .then(function (html) { document.open(); document.write(html); document.close(); });
</script>
HTML
# Don't let Pages' Jekyll step drop the _expo folders.
touch "$OUT/.nojekyll"
echo "Built $OUT for GitHub Pages"
