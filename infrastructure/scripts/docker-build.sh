#!/usr/bin/env bash
# Builds one or all frontend app images directly with `docker build` (rather
# than compose) — this is what CI uses so each app's build/push can run as
# an independent, parallel job. See infrastructure/ci/github-actions/docker-build.yml.
#
#   infrastructure/scripts/docker-build.sh customer-app infrastructure/environments/.env.production
#   infrastructure/scripts/docker-build.sh all infrastructure/environments/.env.staging
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

APP="${1:?usage: docker-build.sh <app-name|all> [env-file]}"
ENV_FILE="${2:-infrastructure/environments/.env.production}"

infrastructure/scripts/validate-env.sh "$ENV_FILE"
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

all_apps=(customer-app restaurant-app admin-app delivery-app)

if [[ "$APP" == "all" ]]; then
  apps=("${all_apps[@]}")
else
  apps=("$APP")
fi

for app in "${apps[@]}"; do
  image="${IMAGE_REGISTRY}/${app}:${IMAGE_TAG}"
  echo "==> Building $image (configuration=$BUILD_CONFIGURATION)"
  docker build \
    -f infrastructure/docker/frontend.Dockerfile \
    --build-arg "APP_NAME=${app}" \
    --build-arg "BUILD_CONFIGURATION=${BUILD_CONFIGURATION}" \
    --build-arg "NODE_VERSION=${NODE_VERSION}" \
    --build-arg "NGINX_VERSION=${NGINX_VERSION}" \
    -t "$image" \
    .
  echo "==> Built $image"
done
