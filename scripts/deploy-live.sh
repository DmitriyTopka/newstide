#!/bin/sh
# Deploys the public live site (PUBLIC_LIVE=1) to the separate Vercel project newstide-live.
# The judges' replay demo (newstide-paper) is deployed with scripts/deploy-demo.sh and is not touched.
set -e
APP="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$APP/../deploy-live"
mkdir -p "$OUT"
rsync -a --delete --exclude .vercel --exclude deploy-live --exclude .env --exclude 'runs/' --exclude 'data/sample/' --exclude node_modules --exclude .git "$APP/" "$OUT/"
cd "$OUT"
[ -d .vercel ] || vercel link --yes --project newstide-live
vercel deploy --prod --yes
