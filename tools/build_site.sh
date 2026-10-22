#!/usr/bin/env bash
# Assemble the published site in one folder: the front page, every talk, and what they load (web/, vendor/).
# Nothing else in the repo is published.
#
#   tools/build_site.sh [out]        default out: site/ in the repo
#
# Cloudflare Pages runs this on every push to main (build command "bash tools/build_site.sh", output "site");
# tools/deploy_pages.sh uses it for a manual upload.
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
out=$(realpath -m "${1:-$repo/site}")
rm -rf "$out"
mkdir -p "$out"
cp "$repo/index.html" "$out/"
cp -r "$repo/web" "$repo/vendor" "$repo/talks" "$out/"
# the checker's pictures (talks/*/check/), if any are lying around locally
find "$out/talks" -mindepth 2 -maxdepth 2 -type d -name check -exec rm -rf {} +
echo "site: $(find "$out" -type f | wc -l) files, $(du -sh "$out" | cut -f1) in $out"
