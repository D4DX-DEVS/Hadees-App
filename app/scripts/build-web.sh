#!/bin/sh
# Export the web build and make it deployable to Cloudflare Pages or Vercel
# (static hosts may skip folders named node_modules, which is where Expo puts font/icon assets).
# Runs on macOS and Linux (Vercel builds on Linux).
set -e
cd "$(dirname "$0")/.."
rm -rf dist
npx expo export -p web
if [ -d dist/assets/node_modules ]; then
  mv dist/assets/node_modules dist/assets/vendor
  grep -rl "assets/node_modules" dist --include=*.js --include=*.html --include=*.json | xargs sed -i.bak 's#assets/node_modules#assets/vendor#g'
  find dist -name '*.bak' -delete
fi
echo "dist ready: $(find dist -type f | wc -l) files"
