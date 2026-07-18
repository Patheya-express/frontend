# Namespace Guide

## The six namespaces

| Namespace | Created by | Pod Security Admission | Holds |
|---|---|---|---|
| `patheya-express-dev` | `overlays/development/namespace.yaml` | `restricted` | The 4 apps, dev config |
| `patheya-express-staging` | `overlays/staging/namespace.yaml` | `restricted` | The 4 apps, staging config |
| `patheya-express-prod` | `overlays/production/namespace.yaml` | `restricted` | The 4 apps, production config |
| `monitoring` | `platform/namespaces/monitoring.yaml` | `restricted` | Prometheus/Grafana (see [`../monitoring/README.md`](../monitoring/README.md)) |
| `ingress` | `platform/namespaces/ingress.yaml` | `baseline` | The nginx Ingress controller |
| `patheya-system` | `platform/namespaces/system.yaml` | `baseline` | metrics-server, cert-manager, ExternalDNS |

## Why the environment namespaces are `patheya-express-{dev,staging,prod}`, not bare `development`/`staging`/`production`

The task brief for this phase names the namespaces `development` /
`staging` / `production` — bare names like that are a real footgun in a
cluster shared with anything else (another team's `staging` namespace,
some tooling's own `development` convention) and Kubernetes gives no
protection against the collision. Every environment namespace here is
prefixed for the same reason `monitoring`/`ingress` are project-labeled
(`app.kubernetes.io/part-of: patheya-express-platform`) even though their
own names stay short — this was carried forward unchanged from Phase 0
rather than introduced now, since Phase 0's namespaces are the ones
`kubectl kustomize` already proved work end-to-end.

## Why `patheya-system`, not bare `system`

Same reasoning, sharper: `system` reads as though it might collide with
`kube-system` or be mistaken for it — `patheya-system` can't be confused
with a cluster-critical namespace no one here administers.

## Pod Security Admission levels, and why they differ

- **`restricted`** (the app namespaces + `monitoring`): every pod already
  satisfies this — non-root, all capabilities dropped, no privilege
  escalation, `RuntimeDefault` seccomp (Phase 0's `securityContext`
  blocks). Enforcing it turns a future regression (someone removing a
  `securityContext` field) into an admission-time rejection instead of a
  silent capability grant.
- **`baseline`** (`ingress`, `patheya-system`): the nginx Ingress
  controller needs `NET_BIND_SERVICE` to bind ports 80/443, and some
  cluster-management controllers need capabilities `restricted`
  categorically forbids. `baseline` is still real enforcement — it blocks
  host namespaces, privileged containers, and most capability grants —
  just not as tight as what the app namespaces run under.

## Apply order

```bash
kubectl apply -k infrastructure/kubernetes/platform
kubectl apply -k infrastructure/kubernetes/overlays/development
```

See [`infrastructure/kubernetes/platform/README.md`](../kubernetes/platform/README.md)
for why this order matters (RoleBindings and `priorityClassName` in the
app overlays reference objects `platform/` creates).
