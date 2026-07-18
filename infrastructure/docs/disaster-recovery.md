# Disaster Recovery Preparation

## What's actually at risk

Nothing stateful. Every app here is a stateless static SPA — there is no
database, no persistent volume, no user-uploaded data, and no in-memory
session state anywhere in this repo's infrastructure. The only things that
could be "lost" are:

1. **Source** — recoverable from git (this repo + `patheya-express-platform`).
2. **Built images** — recoverable by re-running CI against any past commit
   (`.github/workflows/docker-build.yml` tags every image with the commit
   SHA, so any previously-built version can be redeployed byname without
   rebuilding).
3. **DNS/certificates** (`infrastructure/terraform`) — recoverable by
   re-running `terraform apply` against the same state backend.

This makes frontend DR fundamentally simpler than the backend's (database
backups, point-in-time recovery, etc. — owned by `patheya-express-platform`,
out of scope here).

## RTO / RPO

| | Target | Why |
|---|---|---|
| RPO (data loss) | Zero | No persisted state to lose |
| RTO (time to restore service) | Minutes | Redeploying a known-good image tag to Kubernetes is a `kubectl apply -k` away — no data restore, no migration replay |

## Rollback procedure

1. Identify the last known-good commit SHA (from `git log` or the CI run
   history for `docker-build.yml`).
2. Edit the target overlay's `images:` tag
   (`infrastructure/kubernetes/overlays/<environment>/kustomization.yaml`)
   to that SHA, or pass it via `kustomize edit set image`.
3. `kubectl apply -k infrastructure/kubernetes/overlays/<environment>`.
   The `RollingUpdate` strategy (`maxUnavailable: 0`) means this never
   drops below the configured replica count mid-rollout.

No database migration to reverse, no cache to invalidate beyond the CDN/
browser cache (already handled — `index.html` is `no-store`, content-hashed
assets are immutable, so a rollback's new `index.html` immediately points
browsers at the correct, already-cached-or-fetched bundle).

## Full cluster/region loss

1. Re-provision the cluster (outside this repo's scope — see
   [`infrastructure/terraform/README.md`](../terraform/README.md)).
2. `terraform apply` in `infrastructure/terraform/environments/<env>`
   against the existing remote state to recreate DNS records and the ACM
   certificate (or a fresh cert if the old one's validation records were
   lost with the zone).
3. `kubectl apply -k infrastructure/kubernetes/overlays/<env>` to
   recreate every Deployment/Service/Ingress/HPA from source — nothing
   here depends on any previous cluster state.
4. Point DNS at the new Ingress controller's load balancer (update
   `ingress_hostname` in `terraform.tfvars` and re-apply).

## Dependency on the backend

The frontend degrading gracefully during a *backend* outage is a frontend
application-code concern (loading states, error boundaries, retry logic in
`libs/shared/api-sdk`) — not an infrastructure one, and not something this
phase changes. From an infra standpoint, the frontend containers stay
healthy and keep serving the static app shell even if
`patheya-express-platform`'s API is down; users would see the app's own
error UI rather than a blank page, since nginx has nothing to proxy or
depend on (see [infrastructure-overview.md](infrastructure-overview.md)).

## What this phase does NOT cover

- Automated backup verification / restore drills — there's nothing
  stateful here to back up.
- Multi-region active-active failover — not provisioned by
  `infrastructure/terraform` in this phase (single Route53 zone, single
  region per environment). Revisit once the backend's own multi-region
  posture is decided, since a frontend-only failover without the backend
  following isn't useful.
