#!/usr/bin/env bash
# Fails fast on a missing/malformed infra env file before docker compose or
# CI ever reads it — see infrastructure/docs/environment-guide.md.
#
#   infrastructure/scripts/validate-env.sh infrastructure/environments/.env.production
set -euo pipefail

ENV_FILE="${1:?usage: validate-env.sh <path-to-env-file>}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ $ENV_FILE does not exist" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

required_vars=(
  BUILD_CONFIGURATION
  CUSTOMER_APP_PORT
  RESTAURANT_APP_PORT
  ADMIN_APP_PORT
  DELIVERY_APP_PORT
  NODE_VERSION
  NGINX_VERSION
  IMAGE_REGISTRY
  IMAGE_TAG
)

missing=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "✗ $ENV_FILE is missing required variable(s): ${missing[*]}" >&2
  exit 1
fi

case "$BUILD_CONFIGURATION" in
  development|staging|production) ;;
  *)
    echo "✗ BUILD_CONFIGURATION='$BUILD_CONFIGURATION' must be one of: development, staging, production" >&2
    echo "  (these must match an Angular build configuration in apps/*/project.json — never invent a new one here)" >&2
    exit 1
    ;;
esac

for port_var in CUSTOMER_APP_PORT RESTAURANT_APP_PORT ADMIN_APP_PORT DELIVERY_APP_PORT; do
  value="${!port_var}"
  if ! [[ "$value" =~ ^[0-9]+$ ]] || (( value < 1 || value > 65535 )); then
    echo "✗ $port_var='$value' is not a valid port number (1-65535)" >&2
    exit 1
  fi
done

ports=("$CUSTOMER_APP_PORT" "$RESTAURANT_APP_PORT" "$ADMIN_APP_PORT" "$DELIVERY_APP_PORT")
unique_ports=($(printf '%s\n' "${ports[@]}" | sort -u))
if [[ ${#unique_ports[@]} -ne ${#ports[@]} ]]; then
  echo "✗ CUSTOMER_APP_PORT/RESTAURANT_APP_PORT/ADMIN_APP_PORT/DELIVERY_APP_PORT must all be distinct, got: ${ports[*]}" >&2
  exit 1
fi

echo "✓ $ENV_FILE is valid"
