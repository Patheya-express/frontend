# Platform (Cluster-Wide) Resources

Everything in `infrastructure/kubernetes/base` and
`infrastructure/kubernetes/overlays` is namespace-scoped and specific to
one of the four frontend apps. This directory is the opposite: cluster-wide
resources that exist once, independent of any environment, that the app
overlays *reference* but don't own.

## Apply order matters

```bash
kubectl apply -k infrastructure/kubernetes/platform          # first
kubectl apply -k infrastructure/kubernetes/overlays/development  # then
```

The app overlays' RoleBindings reference the `patheya-frontend-viewer`
ClusterRole defined here by name, and every Deployment's
`priorityClassName` references a PriorityClass defined here — applying an
overlay first doesn't error (Kubernetes allows a RoleBinding/pod spec to
reference a not-yet-existing object), it just grants nothing / schedules at
default priority until `platform/` catches up.

## What's here

| Path | Provides | Requires (not installed by this repo) |
|---|---|---|
| `namespaces/` | `monitoring`, `ingress`, `patheya-system` namespaces, each with a Pod Security Admission level matched to what actually runs there | — |
| `priority-classes/` | `patheya-critical/high/normal/low-priority` (see [`../../docs/scaling-strategy.md`](../../docs/scaling-strategy.md)) | — |
| `rbac/` | `patheya-frontend-viewer` ClusterRole (read-only, bound per-namespace by each overlay) | An OIDC group mapping to actually bind it to anyone (see the file's own comments) |
| `metrics-server/` | Standard metrics-server v0.7.2 manifest — required for the HPAs in `base/*/hpa.yaml` to have CPU/memory data at all | Nothing — self-contained, but note the `--kubelet-insecure-tls` flag documented inline |
| `cert-manager/` | `letsencrypt-staging`/`letsencrypt-production` `ClusterIssuer`s | cert-manager's own CRDs + controller (Helm) |
| `external-dns/` | ExternalDNS controller, running in `--dry-run` (logs intended changes, makes none) | Real AWS credentials + `--dry-run` removed, once Phase 2 decides DNS should be controller-managed rather than Terraform-managed (see `external-dns.yaml`'s comments) |
| `external-secrets/` | An **example only** `SecretStore`/`ExternalSecret` pair, not applied by any kustomization | External Secrets Operator — and an actual secret to manage, which none of the four apps have yet |

## What's NOT here

Anything that provisions real cloud infrastructure (the cluster itself,
IAM roles, actual DNS records) — see
[`infrastructure/terraform/README.md`](../../terraform/README.md). This
directory only holds Kubernetes objects, applied to a cluster that already
exists.
