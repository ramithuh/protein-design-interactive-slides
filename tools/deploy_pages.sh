#!/usr/bin/env bash
# Publish the decks to Cloudflare Pages as a static site: the front page, every talk, and what they load.
#
#   tools/deploy_pages.sh [project]        default project: interactive-slides
#
# Needs wrangler, logged in (wrangler login). The site is the repo's index.html, talks/, web/ and vendor/,
# copied to a temporary folder without check pictures, so nothing else in the repo is published.
set -euo pipefail

project=${1:-interactive-slides}
repo=$(cd "$(dirname "$0")/.." && pwd)
site=$(mktemp -d)
trap 'rm -rf "$site"' EXIT

cp "$repo/index.html" "$site/"
cp -r "$repo/web" "$repo/vendor" "$site/"
mkdir -p "$site/talks"
for talk in "$repo"/talks/*/; do
  name=$(basename "$talk")
  mkdir -p "$site/talks/$name"
  (cd "$talk" && find . -path ./check -prune -o -type f -print | cpio -pdm --quiet "$site/talks/$name")
done
du -sh "$site"
wrangler pages deploy "$site" --project-name "$project" --branch main --commit-dirty=true
