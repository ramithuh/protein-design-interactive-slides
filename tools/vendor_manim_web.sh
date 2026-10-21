#!/usr/bin/env bash
# Rebuild vendor/manim-web/manim-web.iife.js from an npm release of manim-web.
#
#   tools/vendor_manim_web.sh [version]      default 0.39.4
#
# manim-web ships ES modules with lazily loaded chunks, and Chrome will not load an ES module from file://,
# so an offline deck needs one classic script instead. esbuild inlines the chunks into an IIFE that sets
# window.ManimWeb. The few import() calls left are optional extras (Node fs, MathJax font fetching, PPTX
# export) that the live slides never reach.
set -euo pipefail

version=${1:-0.39.4}
repo=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cd "$work"
npm init -y > /dev/null
npm install --ignore-scripts --no-audit --no-fund "manim-web@$version" esbuild@0.24.2 > /dev/null
./node_modules/.bin/esbuild node_modules/manim-web/dist/manim-web.browser.js --bundle --format=iife \
  --global-name=ManimWeb --minify --legal-comments=none --log-level=warning \
  --outfile="$repo/vendor/manim-web/manim-web.iife.js"
cp node_modules/manim-web/LICENSE "$repo/vendor/manim-web/LICENSE"
echo "$version" > "$repo/vendor/manim-web/VERSION"
ls -la "$repo/vendor/manim-web/manim-web.iife.js"
