#!/usr/bin/env bash
# Counterpart to infra-up.sh — tears down whichever overlay is running.
# Safe to call for any environment; compose no-ops on services that aren't up.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENVIRONMENT="${1:?usage: infra-down.sh <development|staging|production>}"

case "$ENVIRONMENT" in
  development)
    exec docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml down
    ;;
  staging)
    exec docker compose -f docker/docker-compose.yml down
    ;;
  production)
    exec docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml down
    ;;
  *)
    echo "✗ unknown environment '$ENVIRONMENT' (expected development, staging, or production)" >&2
    exit 1
    ;;
esac
