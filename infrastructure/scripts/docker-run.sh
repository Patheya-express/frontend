#!/usr/bin/env bash
# Runs a single already-built app image standalone (outside compose) for a
# quick smoke test — builds it first if the image tag doesn't exist yet.
#
#   infrastructure/scripts/docker-run.sh customer-app 4200 infrastructure/environments/.env.production
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

APP="${1:?usage: docker-run.sh <app-name> [host-port] [env-file]}"
HOST_PORT="${2:-8080}"
ENV_FILE="${3:-infrastructure/environments/.env.production}"

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

IMAGE="${IMAGE_REGISTRY}/${APP}:${IMAGE_TAG}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  infrastructure/scripts/docker-build.sh "$APP" "$ENV_FILE"
fi

CONTAINER_NAME="patheya-${APP}-smoke"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "==> Starting $IMAGE on http://localhost:${HOST_PORT}"
docker run -d --name "$CONTAINER_NAME" -p "${HOST_PORT}:8080" "$IMAGE"

echo "==> Waiting for /healthz"
for _ in $(seq 1 20); do
  if curl -fsS "http://localhost:${HOST_PORT}/healthz" >/dev/null 2>&1; then
    echo "✓ $APP is healthy at http://localhost:${HOST_PORT}"
    exit 0
  fi
  sleep 1
done

echo "✗ $APP never became healthy — check: docker logs $CONTAINER_NAME" >&2
exit 1
