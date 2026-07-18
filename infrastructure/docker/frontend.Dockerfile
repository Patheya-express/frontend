# syntax=docker/dockerfile:1
#
# Shared production Dockerfile for all four Angular SPAs (admin-app, customer-app,
# delivery-app, restaurant-app). They are structurally identical Nx-built static
# bundles sharing the same libs/ workspace, so one parameterized image definition
# is used instead of four drifting copies — select the app with --build-arg.
#
# Build context MUST be the repository root (not infrastructure/docker/), because
# Nx/pnpm need the full workspace (nx.json, tsconfig.base.json, libs/*) to build
# any single app.
#
#   docker build -f infrastructure/docker/frontend.Dockerfile \
#     --build-arg APP_NAME=customer-app \
#     --build-arg BUILD_CONFIGURATION=production \
#     -t patheya-express-customer-app .
#
# See infrastructure/docs/docker-guide.md for the full reference.

ARG NODE_VERSION=24-alpine
ARG NGINX_VERSION=1.27-alpine

# ---------------------------------------------------------------------------
# build: installs the full pnpm workspace, then builds a single Angular app.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS build

ARG APP_NAME
# Must be one of the existing Angular build configurations defined in each
# app's project.json (development/staging/production) — never a new one
# invented here, so this stays config-only and touches no app source.
ARG BUILD_CONFIGURATION=production

RUN test -n "$APP_NAME" || (echo "APP_NAME build-arg is required" && exit 1)

RUN corepack enable

WORKDIR /workspace

# Install dependencies first so this layer is cached across app rebuilds
# whenever only application source changes, not the lockfile.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json nx.json ./
COPY apps ./apps
COPY libs ./libs

RUN pnpm install --frozen-lockfile

RUN pnpm exec nx build ${APP_NAME} --configuration=${BUILD_CONFIGURATION}

# ---------------------------------------------------------------------------
# dev: full workspace + Angular dev server with HMR, used only by
# infrastructure/docker/docker-compose.dev.yml (bind-mounts source over this
# layer so container rebuilds aren't needed on every file change). Never
# used for staging/production images — those stop at `runtime` below.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS dev

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

RUN corepack enable
WORKDIR /workspace

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json nx.json ./
COPY apps ./apps
COPY libs ./libs

RUN pnpm install --frozen-lockfile

EXPOSE 8080
CMD pnpm exec nx serve ${APP_NAME} --host 0.0.0.0 --port 8080

# ---------------------------------------------------------------------------
# runtime: nginx-unprivileged — runs as a non-root user out of the box (uid
# 101), listens on 8080, and owns /var/cache/nginx already, so no manual
# chown of nginx internals is needed.
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS runtime

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY infrastructure/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY infrastructure/docker/nginx/app.conf.template /etc/nginx/conf.d/default.conf

COPY --from=build --chown=101:101 /workspace/dist/apps/${APP_NAME}/browser /usr/share/nginx/html

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

# SIGQUIT tells nginx's master process to finish in-flight requests before
# exiting (fast SIGTERM would cut connections mid-response) — see the
# Graceful Shutdown section in infrastructure/docs/production-guide.md.
STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
