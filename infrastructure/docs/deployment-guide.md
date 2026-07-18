# Deployment Guide

## Rolling update strategy

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
```

`maxUnavailable: 0` means a rollout never drops below the current replica
count — a new pod must be Ready before an old one is terminated.
`maxSurge: 1` caps how many extra pods exist mid-rollout to one at a time,
trading rollout speed for a smaller resource-quota footprint during the
transition (relevant given each environment's `ResourceQuota` — see
[namespace-guide.md](namespace-guide.md)).

## Probe stack: startup -> readiness -> liveness

All three probes hit the same `/healthz` (startup, liveness) or `/readyz`
(readiness) endpoints nginx exposes (Phase 0,
`infrastructure/docker/nginx/app.conf.template`):

| Probe | Path | Budget | Purpose |
|---|---|---|---|
| `startupProbe` | `/healthz` | 5 x 3s = 15s | New in Phase 1. Lets liveness/readiness start immediately (no `initialDelaySeconds` guesswork) without risking a restart loop under scheduling pressure — nginx actually starts in well under a second, so this budget is generous headroom, not a tuned-for-slow-start value |
| `livenessProbe` | `/healthz` | 5s delay, every 15s, 3 failures | Restarts the container if nginx stops responding at all |
| `readinessProbe` | `/readyz` | 3s delay, every 10s, 3 failures | Pulls the pod out of the Service's endpoints if `index.html` isn't actually present — `try_files /index.html =503` (Phase 0) |

## Graceful termination

Unchanged from Phase 0, still validated:
`terminationGracePeriodSeconds: 30`, covering a `preStop` hook
(`sleep 5 && nginx -s quit`) that gives the endpoint controller time to
remove the pod from the Service before nginx stops accepting connections,
then asks nginx to finish in-flight requests rather than drop them. See
Phase 0's [production-guide.md](production-guide.md) for the full
rationale and the measured result (`docker compose stop` completed in
under 2 seconds in that phase's container-only test).

## Scheduling: where a pod actually lands

Four mechanisms, each solving a different problem:

1. **`priorityClassName`** — which pod the scheduler protects first under
   node pressure. `patheya-high-priority` for `customer-app`,
   `restaurant-app`, `delivery-app` (customer/partner/delivery-facing
   critical paths); `patheya-normal-priority` for `admin-app`
   (internal-only). See [autoscaling-guide.md](autoscaling-guide.md).
2. **`nodeAffinity`** (soft/preferred) — prefers a node labeled
   `node.kubernetes.io/workload=frontend`, if the cluster labels nodes
   that way. A no-op, not a scheduling failure, on a cluster that doesn't.
3. **`podAntiAffinity`** (soft/preferred, host-level) — spreads replicas
   of the *same* app across different nodes, so one node failure doesn't
   take out every replica of one app.
4. **`topologySpreadConstraints`** (soft, zone-level, `maxSkew: 1`) — new
   in Phase 1, spreads replicas across availability zones for real
   multi-AZ redundancy. `whenUnsatisfiable: ScheduleAnyway` rather than
   `DoNotSchedule`, deliberately: a single-AZ dev/staging cluster (common,
   cheap) must still be able to schedule pods at all — this constraint
   should never be the reason a pod goes unschedulable, only a preference
   the scheduler honors when it can.

## ServiceAccount

Every Deployment sets `serviceAccountName: <app>` (Phase 1, previously
implicit `default`) — pointing at a dedicated, permission-less
ServiceAccount rather than the namespace's shared `default` one. See
[rbac-guide.md](rbac-guide.md).

## Resource requests/limits

CPU, memory, *and* (new in Phase 1) `ephemeral-storage` on every
container — the three `emptyDir` volumes (`/tmp`, `/var/cache/nginx`,
`/var/run`) count against a pod's ephemeral-storage usage same as any
writable-layer disk use, so bounding it stops one misbehaving pod from
starving shared node disk. See each app's `deployment.yaml` for the exact
values (25m/32Mi/32Mi request, 250m/128Mi/128Mi limit for the app
container; a fifth of that for the metrics-exporter sidecar).
