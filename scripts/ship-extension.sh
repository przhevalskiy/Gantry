#!/usr/bin/env bash
# Build Chrome → Edge → Firefox zip artifacts for one micro extension.
# Ship order: Chrome Web Store, then Edge Add-ons, then Firefox AMO.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <app-id>"
  echo "Example: $0 paybump"
  exit 1
fi

APP_DIR="$ROOT/apps/$NAME"
if [[ ! -f "$APP_DIR/wxt.config.ts" ]]; then
  echo "Missing $APP_DIR/wxt.config.ts"
  echo "Merge/checkout the extension app before shipping."
  exit 1
fi

if [[ ! -d "$APP_DIR/store" ]]; then
  echo "No store/ metadata yet — seeding templates..."
  "$ROOT/scripts/seed-extension-store.sh" "$NAME"
fi

cd "$APP_DIR"
if [[ ! -d node_modules ]]; then
  npm install
fi

echo "==> Chrome / Chromium MV3 build + zip"
npm run build
npm run zip

echo "==> Firefox MV3 build + zip"
npm run build:firefox
npm run zip:firefox

OUT="$APP_DIR/.output"
SHIP="$OUT/store-ship"
mkdir -p "$SHIP"

# WXT zip output names can vary; collect newest zips
chrome_zip="$(ls -t "$OUT"/*chrome*.zip "$OUT"/*.zip 2>/dev/null | head -1 || true)"
# Prefer explicit chrome zip if multiple
if ls "$OUT"/*chrome*.zip >/dev/null 2>&1; then
  chrome_zip="$(ls -t "$OUT"/*chrome*.zip | head -1)"
fi
ff_zip=""
if ls "$OUT"/*firefox*.zip >/dev/null 2>&1; then
  ff_zip="$(ls -t "$OUT"/*firefox*.zip | head -1)"
fi

if [[ -z "${chrome_zip}" || ! -f "${chrome_zip}" ]]; then
  # Fallback: zip the chrome-mv3 directory ourselves
  chrome_zip="$SHIP/$NAME-chrome.zip"
  (cd "$OUT/chrome-mv3" && zip -qr "$chrome_zip" .)
else
  cp -f "$chrome_zip" "$SHIP/$NAME-chrome.zip"
fi

# Edge uses the Chromium package
cp -f "$SHIP/$NAME-chrome.zip" "$SHIP/$NAME-edge.zip"

if [[ -n "${ff_zip}" && -f "${ff_zip}" ]]; then
  cp -f "$ff_zip" "$SHIP/$NAME-firefox.zip"
elif [[ -d "$OUT/firefox-mv3" ]]; then
  (cd "$OUT/firefox-mv3" && zip -qr "$SHIP/$NAME-firefox.zip" .)
else
  echo "WARN: Firefox zip not found — check build:firefox output"
fi

cat > "$SHIP/README.md" <<EOF
# $NAME store artifacts

Ship order:

1. **Chrome** — upload \`$NAME-chrome.zip\` to https://chrome.google.com/webstore/devconsole
2. **Edge** — upload \`$NAME-edge.zip\` to https://partner.microsoft.com/dashboard (Edge extensions)
3. **Firefox** — upload \`$NAME-firefox.zip\` to https://addons.mozilla.org/developers/

Listing / privacy / permissions: \`apps/$NAME/store/\`

Process doc: \`docs/extension-store-shipping.md\`
EOF

echo
echo "Done. Artifacts:"
ls -la "$SHIP"
echo
echo "Upload order: chrome → edge → firefox"
echo "Docs: $ROOT/docs/extension-store-shipping.md"
