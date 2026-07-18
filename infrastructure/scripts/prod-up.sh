#!/usr/bin/env bash
# Builds and starts the hardened, resource-limited production stack on a
# single host. For a real cluster, use infrastructure/kubernetes instead.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

./scripts/validate-env.sh environments/.env.production

docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.prod.yml \
  --env-file environments/.env.production \
  up --build -d

docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml ps
