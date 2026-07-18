#!/usr/bin/env bash
# Keeps only the N most recently built local images per app (default 3),
# removing older tags to reclaim disk space. Intended for long-running CI
# runners / dev machines that accumulate many local builds over time.
#
#   infrastructure/scripts/image-cleanup.sh customer-app 3
#   infrastructure/scripts/image-cleanup.sh all 3
set -euo pipefail

APP="${1:-all}"
KEEP="${2:-3}"

all_apps=(customer-app restaurant-app admin-app delivery-app)
if [[ "$APP" == "all" ]]; then
  apps=("${all_apps[@]}")
else
  apps=("$APP")
fi

for app in "${apps[@]}"; do
  echo "==> $app: keeping the $KEEP most recent images"
  mapfile -t ids < <(docker images --format '{{.CreatedAt}}|{{.ID}}' --filter "reference=*/${app}" \
    | sort -r | awk -F'|' '{print $2}' | tail -n +"$((KEEP + 1))")
  if [[ ${#ids[@]} -eq 0 ]]; then
    echo "    nothing to remove"
    continue
  fi
  docker rmi "${ids[@]}" 2>/dev/null || true
done
