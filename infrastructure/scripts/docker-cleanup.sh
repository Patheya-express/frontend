#!/usr/bin/env bash
# Removes stopped containers, the compose network, and dangling (untagged)
# layers left behind by iterative `docker build` runs. Does NOT touch
# tagged images still in use — see image-cleanup.sh for pruning old tags.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Stopping and removing the compose stack (all overlays)"
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker/docker-compose.yml down --remove-orphans 2>/dev/null || true

echo "==> Pruning dangling images and build cache"
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "✓ Cleanup complete"
