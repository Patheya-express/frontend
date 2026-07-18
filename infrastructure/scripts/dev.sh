#!/usr/bin/env bash
# Starts all four apps with hot-reload dev servers in Docker.
# For most day-to-day work, `nx serve <app>` directly on the host is faster
# (no image rebuild on dependency changes) — this script is for verifying
# the containerized dev path itself, or for a machine without Node installed.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

./scripts/validate-env.sh environments/.env.development

docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.dev.yml \
  --env-file environments/.env.development \
  up --build
