#!/bin/sh
# Export the web build and make it deployable to Cloudflare Pages
# (wrangler skips folders named node_modules, which is where Expo puts font/icon assets).
set -e
cd "$(dirname "$0")/.."
rm -rf dist
npx expo export -p web
if [ -d dist/assets/node_modules ]; then
  mv dist/assets/node_modules dist/assets/vendor
  grep -rl "assets/node_modules" dist --include=*.js --include=*.html --include=*.json | xargs sed -i '' 's#assets/node_modules#assets/vendor#g'
fi
echo "dist ready: $(find dist -type f | wc -l) files"
