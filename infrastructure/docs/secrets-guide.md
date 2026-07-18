# Secrets Guide

## This frontend ships zero runtime secrets — by design

All four apps are static, client-side Angular SPAs. Every value in
`apps/*/src/environments/environment*.ts` (see
[`AppEnvironment`](../../libs/shared/core/src/lib/environment/app-environment.ts))
ends up in the browser bundle, in plain text, for anyone to read via
DevTools. That makes it structurally impossible to keep a value there
secret — so nothing sensitive belongs in those files, and nothing sensitive
is in them today:

| Value | Why it's safe to ship client-side |
|---|---|
| `apiBaseUrl`, `socketUrl`, `mediaBaseUrl` | Public endpoints, not credentials |
| `razorpayKeyId` | Razorpay's checkout key IDs are public by design (`rzp_live_...`) — the corresponding secret key stays server-side only, in the backend |
| `maps.googleMapsApiKey` | A browser-restricted key (HTTP referrer allowlist), meant to be public |

If a future change ever needs a real secret in one of these apps (e.g. a
private API key), it must **not** go into `environment*.ts` — that file is
compiled into a public, static asset. Route it through a backend proxy
endpoint instead.

## What actually needs protecting in this repo

Nothing the running application reads, but a few things the *infrastructure
around it* uses:

| Secret | Used by | Where it lives |
|---|---|---|
| Container registry push credentials | CI (`infrastructure/ci/github-actions/docker-build.yml`) | GitHub Actions encrypted secrets (`GHCR_TOKEN` or OIDC to the registry) — never in a workflow file or committed `.env` |
| `KUBECONFIG` / cluster service-account token | Deploy tooling (not yet wired up — see infrastructure/ci) | Kubernetes Secret / CI environment secret, provisioned per cluster |
| Cloud provider credentials (Terraform) | `infrastructure/terraform` | Environment variables / OIDC federation at apply time — never a `.tfvars` file committed to git |
| Any TLS certificate private key | Ingress (`infrastructure/kubernetes`) | `kubernetes.io/tls` Secret, issued by cert-manager — never checked in |

None of `infrastructure/environments/.env.*` in this repo contain secrets
either — they're port numbers and build configuration selectors (see
[environment-guide.md](environment-guide.md)). They're safe to commit and
are committed.

## Secrets strategy by target

### Docker Secrets (single-host `docker-compose.prod.yml` deployments)
Not currently needed — there's nothing to inject. If that changes, mount
via `docker secret` / `/run/secrets/<name>` rather than an environment
variable, since env vars are visible via `docker inspect` to anyone with
daemon access.

### Kubernetes Secrets
`infrastructure/kubernetes` defines no `Secret` objects because the
Deployments have nothing secret to consume — they run `nginx` serving a
prebuilt static bundle. The one place a real cluster needs a Secret is the
Ingress TLS certificate (`infrastructure/kubernetes/base/*/ingress.yaml`
references `secretName:` — provisioned by cert-manager, not hand-created).

### AWS Secrets Manager
Reserved for the backend (`patheya-express-platform`), which owns the
values in its own `.env.example` (`DATABASE_URL`, `JWT_*_SECRET`,
`RAZORPAY_KEY_SECRET`, `SMTP_*`, `CLOUDINARY_*`). This frontend repo has no
equivalent list — see the table above for the complete set of things it
manages, all non-secret.

## Rules

1. Never commit a filled-in `.env` file — only `.env.example` and the
   infra-level `infrastructure/environments/.env.{development,staging,production}`
   files (which contain no secrets, see above) are tracked in git.
2. Never put a private key, token, or credential in
   `apps/*/src/environments/*.ts` — it will end up in the public bundle.
3. CI secrets are referenced by name (`${{ secrets.GHCR_TOKEN }}`), never
   echoed to logs, never written to a file checked into the workspace.
4. If a genuinely secret value is ever needed at container *runtime* (not
   build time), inject it via the orchestrator's secret mechanism (Kubernetes
   Secret volume/env, Docker secret) — never bake it into an image layer.
