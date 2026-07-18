#!/usr/bin/env bash
# Single entry point for starting the frontend stack in any environment —
# picks the right compose overlay and env file so CI/deploy tooling only
# needs to know one command.
#
#   infrastructure/scripts/infra-up.sh development
#   infrastructure/scripts/infra-up.sh staging
#   infrastructure/scripts/infra-up.sh production
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENVIRONMENT="${1:?usage: infra-up.sh <development|staging|production>}"
ENV_FILE="environments/.env.${ENVIRONMENT}"

./scripts/validate-env.sh "$ENV_FILE"

case "$ENVIRONMENT" in
  development)
    exec docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml \
      --env-file "$ENV_FILE" up --build -d
    ;;
  staging)
    exec docker compose -f docker/docker-compose.yml \
      --env-file "$ENV_FILE" up --build -d
    ;;
  production)
    exec docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml \
      --env-file "$ENV_FILE" up --build -d
    ;;
  *)
    echo "✗ unknown environment '$ENVIRONMENT' (expected development, staging, or production)" >&2
    exit 1
    ;;
esac
