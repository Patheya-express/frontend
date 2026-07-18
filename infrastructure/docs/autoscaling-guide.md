# Autoscaling Guide

## HorizontalPodAutoscaler

Every app's `hpa.yaml` (Phase 0, unchanged in Phase 1) scales on both CPU
and memory utilization:

```yaml
metrics:
  - type: Resource
    resource: {name: cpu, target: {type: Utilization, averageUtilization: 70}}
  - type: Resource
    resource: {name: memory, target: {type: Utilization, averageUtilization: 80}}
```

Kubernetes scales on whichever metric requests the higher replica count —
memory rarely drives scaling for these apps in practice (nginx serving
static files is CPU-bound under load, not memory-bound), but both are
tracked so a memory leak in the metrics-exporter sidecar can't silently go
unnoticed by an HPA only watching CPU.

**Future custom-metrics compatibility**: the HPA's `metrics:` list is
already `autoscaling/v2` (not the deprecated `v1`), which is the
prerequisite for adding a third entry of `type: Pods` or `type: External`
later — e.g. scaling `customer-app` on nginx's own request rate
(`nginx_http_requests_total`, already exported — see
[`../monitoring/README.md`](../monitoring/README.md)) via a Prometheus
Adapter exposing the `custom.metrics.k8s.io` API. Not added now because
that adapter isn't installed by this repo (same "prepare, don't provision"
boundary as `metrics-server`'s own installation).

**Requires `infrastructure/kubernetes/platform/metrics-server`** to be
applied and running — without it, `kubectl get hpa` shows every target as
`<unknown>` indefinitely; the HPA object exists but never actually scales
anything.

## Min/max replicas and scale thresholds, per environment

| Environment | minReplicas | maxReplicas | Rationale |
|---|---|---|---|
| Development | 1 | 10 | Floor of 1 (no redundancy needed for solo dev work); ceiling matches base default in case someone load-tests locally |
| Staging | 2 | 10 | Floor of 2 so PDB `minAvailable: 50%` (see below) still allows a node drain to proceed |
| Production | 3 | 10 | Floor of 3 spread across zones (topologySpreadConstraints) for real redundancy |

`maxReplicas: 10` is the same in every environment — deliberately not
scaled per-environment, since the ceiling should reflect "how far can this
scale before something else becomes the bottleneck" (in this case,
`ResourceQuota.limits.cpu`/`limits.memory` — see
[namespace-guide.md](namespace-guide.md) and each overlay's
`resourcequota.yaml`), not a guess about peak traffic per environment.

## VerticalPodAutoscaler — recommendation only

`vpa.yaml` per app runs `updateMode: "Off"`: it computes and exposes a
recommendation (`kubectl describe vpa <app>`) but never resizes or evicts
a running pod. Two reasons this stays off rather than `"Auto"`:

1. **Explicit instruction for this phase** — automatic eviction isn't
   enabled yet.
2. **It would fight the HPA.** VPA in `"Auto"` mode changes a container's
   CPU/memory requests, which changes the utilization percentage the HPA
   computes for the exact same resource — both controllers reacting to
   each other's changes is a documented anti-pattern, not a hypothetical
   one.

Revisit only with real recommendation history behind it, and only for
`updateMode: "Initial"` (sets requests on pod creation, no live resize) as
the safer middle ground before ever considering `"Auto"`.

## PodDisruptionBudget and scaling interaction

`pdb.yaml`'s `minAvailable: 50%` scales with whatever `replicas:` an
overlay sets (see [namespace-guide.md](namespace-guide.md) for the
per-environment values) — it bounds *voluntary* disruptions (node drains,
`kubectl evict`), not rolling updates, which the Deployment's own
`maxUnavailable: 0, maxSurge: 1` strategy already governs independently.

## Priority under scale-down / node pressure

`customer-app`, `restaurant-app`, `delivery-app` run at
`patheya-high-priority`; `admin-app` (internal-only, no customer revenue
path) runs at `patheya-normal-priority`. Under node pressure, the
scheduler preempts lower-priority pods before higher-priority ones — see
[`../kubernetes/platform/priority-classes/priority-classes.yaml`](../kubernetes/platform/priority-classes/priority-classes.yaml)
for the full tier definitions, including the unused `critical`/`low` tiers
reserved for platform infrastructure and future batch work respectively.

## Expected behavior under load

1. Request rate rises -> CPU utilization crosses 70% on existing pods.
2. HPA adds replicas (up to `maxReplicas: 10`), one topology-zone-aware
   scheduling decision at a time (`topologySpreadConstraints`, `maxSkew: 1`).
3. New pods pass `startupProbe` (near-instant for a static nginx server)
   before `readinessProbe` ever gets checked, so they don't receive
   traffic before they're actually able to serve it.
4. If sustained load continues past `maxReplicas: 10`, `ResourceQuota`
   becomes the real ceiling — the last replicas simply fail to schedule
   ("exceeded quota") rather than the HPA silently giving up quietly. This
   is intentional: hitting quota should be visible (an alert on pending
   pods), not invisible.
5. Load subsides -> HPA scales down, respecting `behavior.scaleDown.stabilizationWindowSeconds: 300`
   (5 minutes) so a brief dip doesn't thrash replica count, and one pod at
   a time (`policies: [{type: Pods, value: 1, periodSeconds: 60}]`).
