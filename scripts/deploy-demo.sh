#!/bin/sh
# Deploys the judges' replay demo (REPLAY=1, no AI calls, no key) to the Vercel project newstide-paper.
# The REPLAY flag lives here so the demo can never go out as a plain live build by mistake.
set -e
cd "$(dirname "$0")/.."
vercel deploy --prod --yes --env REPLAY=1
curl -s https://newstide-paper.vercel.app/api/mode | grep -q '"replay":true' && echo "demo OK: replay mode" || { echo "demo NOT in replay mode"; exit 1; }
