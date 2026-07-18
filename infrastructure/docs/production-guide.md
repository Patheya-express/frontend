# Production Guide

Everything below lives in
[`infrastructure/docker/nginx/`](../docker/nginx/) and
[`infrastructure/docker/frontend.Dockerfile`](../docker/frontend.Dockerfile)
unless noted otherwise, and was verified running (not just written) during
this phase — see the validation results in
[docker-guide.md](docker-guide.md).

## Compression

`gzip on` in `nginx.conf` for text/JS/CSS/JSON/SVG/font mime types,
`gzip_comp_level 6`. Angular's build already content-hashes and minifies
everything (`outputHashing: "all"` in each app's production config); nginx
only needs to compress the transfer, not re-optimize the bundle.

## Security headers ("helmet"-equivalent)

There's no NestJS/Express process in front of these static assets, so
helmet itself doesn't apply — the equivalent protections are set as nginx
response headers in
[`security-headers.conf`](../docker/nginx/security-headers.conf):
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, and `Strict-Transport-Security` (safe to send
unconditionally since TLS termination always happens upstream — see
[`infrastructure/kubernetes/base/*/ingress.yaml`](../kubernetes/base)).

## CORS

Not applicable to this repo. These are static files with no API of their
own — CORS is a backend concern (`patheya-express-platform`'s
`CUSTOMER_APP_URL`/`RESTAURANT_APP_URL`/`ADMIN_APP_URL`/`DELIVERY_APP_URL`
allowlist in its own `.env.example`), not something nginx here needs to
configure.

## Rate limiting

`limit_req_zone` in `nginx.conf` (60 req/s per client IP, burst 30) applied
to every app's server block — a coarse edge-level guard independent of
whatever rate limiting the backend API applies to its own endpoints.

## Trust proxy / large payloads / timeouts

- `client_max_body_size 2m` — these are static asset servers; nothing here
  ever needs to accept a large upload.
- `client_body_timeout` / `client_header_timeout` / `send_timeout` are all
  set conservatively (10–12s) since there's no long-running request type
  to accommodate.
- "Trust proxy" (Express's `app.set('trust proxy', ...)`) has no nginx
  equivalent to configure here — the real client IP as seen by nginx is
  whatever the Ingress/load balancer forwards, and nginx doesn't need to
  trust an X-Forwarded-For chain for anything security-sensitive (no
  auth, no rate-limit-by-claimed-IP override).

## Graceful shutdown

Two layers, because container runtimes don't uniformly honor a custom
`STOPSIGNAL`:

1. **Image**: `STOPSIGNAL SIGQUIT` in `frontend.Dockerfile` — nginx
   treats `SIGQUIT` as "finish in-flight requests, then exit" versus
   `SIGTERM`'s immediate connection drop.
2. **Kubernetes**: a `preStop` hook
   (`infrastructure/kubernetes/base/*/deployment.yaml`) runs
   `sleep 5 && nginx -s quit` — the sleep covers the window between the
   endpoint controller removing the pod from the Service and kube-proxy
   actually stopping new traffic from reaching it, so nginx doesn't quit
   while still receiving newly-routed requests.

Verified: `docker compose stop` on a running container completed in under
2 seconds — well inside Docker's default 10-second grace period, with no
forced `SIGKILL`.

## Logging

`log_format json_combined` in `nginx.conf` — structured JSON to stdout,
including `$request_id` (nginx's built-in per-request correlation ID,
echoed back to the client as an `X-Request-Id` response header) so a
single request can be traced through nginx and, if the backend logs the
same header, joined with backend request logs. No log rotation
configuration is needed in-container: stdout logging + the container
runtime's own log driver (`json-file`, `max-size: 10m`, `max-file: 3` in
`docker-compose.yml`) handles rotation.

## Memory / resource limits

- `docker-compose.prod.yml`: 128Mi limit / 32Mi reservation per container
  (nginx serving static files is cheap).
- `infrastructure/kubernetes/base/*/deployment.yaml`: the same shape as
  Kubernetes `resources.requests`/`limits`, plus an `HorizontalPodAutoscaler`
  (`hpa.yaml`) scaling on CPU (70%) and memory (80%) utilization.

## Startup validation

`infrastructure/scripts/validate-env.sh` fails fast on a missing or
malformed `infrastructure/environments/.env.*` file before any container
starts — see [environment-guide.md](environment-guide.md). There's no
in-container startup validation step (checking a database/Redis/queue
connection before serving traffic) because these containers have no such
dependencies — nginx serving a static bundle has nothing to fail-fast on
beyond "did the build actually produce `index.html`", which `/readyz`
already checks continuously via its readiness probe rather than once at
startup.

## Hardening beyond headers

- **Non-root**: `nginxinc/nginx-unprivileged`, uid 101 — verified via
  `docker exec ... id` → `uid=101(nginx)`.
- **Read-only root filesystem**: `docker-compose.prod.yml` and the
  Kubernetes Deployments both set `readOnlyRootFilesystem: true` /
  `read_only: true`, with `emptyDir`/`tmpfs` mounts for nginx's three
  actual write targets (`/tmp`, `/var/cache/nginx`, `/var/run`).
- **Dropped capabilities**: `cap_drop: [ALL]` / `capabilities.drop: [ALL]`
  plus `allowPrivilegeEscalation: false` everywhere.
- **`server_tokens off`**: nginx doesn't advertise its version in
  responses or error pages.
