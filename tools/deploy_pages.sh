#!/usr/bin/env bash
# Upload the decks to Cloudflare Pages by hand: the front page, every talk, and what they load (tools/build_site.sh).
# The Pages project connected to the GitHub repo builds on every push to main without this; use it for a
# project that is not connected, or to publish uncommitted work.
#
#   tools/deploy_pages.sh [project]        default project: protein-design-interactive-slides
#
# Needs wrangler, logged in (wrangler login).
set -euo pipefail

project=${1:-protein-design-interactive-slides}
repo=$(cd "$(dirname "$0")/.." && pwd)
site=$(mktemp -d)
trap 'rm -rf "$site"' EXIT

"$repo/tools/build_site.sh" "$site"
wrangler pages deploy "$site" --project-name "$project" --branch main --commit-dirty=true
