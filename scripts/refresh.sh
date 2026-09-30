#!/usr/bin/env bash
# Re-run every data loader, build the site and deploy it to Cloudflare Pages.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== refresh $(date -Is) ==="

# Credentials live outside the repo; .env is gitignored and optional.
[ -f .env ] && set -a && . ./.env && set +a
export GCP_SA_KEY="${GCP_SA_KEY:-$HOME/.config/immoweb/gcp-sa.json}"

# BigQuery is the only credential the build needs.
[ -r "$GCP_SA_KEY" ] || { echo "FATAL: cannot read credential $GCP_SA_KEY" >&2; exit 1; }

# Framework reuses cached loader output, so drop it to force every loader to run again.
rm -rf src/.observablehq/cache/data

npm run build

# Cloudflare Pages rejects files over 25 MiB. Fail here rather than halfway through an upload.
if oversized=$(find dist -type f -size +25M -printf '%p (%s bytes)\n'); [ -n "$oversized" ]; then
  echo "FATAL: files exceed the 25 MiB Cloudflare Pages limit:" >&2
  echo "$oversized" >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN not set: built to dist/ but skipping deploy."
  exit 0
fi

npx wrangler pages deploy dist \
  --project-name "${CF_PAGES_PROJECT:-belgian-real-estate-market}" \
  --commit-dirty=true

echo "=== done $(date -Is) ==="
