# RBAC Guide

Four identities, each scoped to exactly what it needs and nothing else.

## 1. Per-app ServiceAccount — no permissions at all

`base/<app>/serviceaccount.yaml`, one per app, `automountServiceAccountToken: false`.
nginx serving a static bundle never calls the Kubernetes API. The most
least-privilege RBAC for that workload isn't a tightly-scoped Role — it's
no Role and no mounted token, closing off the entire
service-account-token attack surface rather than granting-and-restricting
it. No Role is bound to any of these four ServiceAccounts.

## 2. `ci-deployer` — namespace-scoped, for Phase 2's CI/CD

`base/rbac-ci-deployer.yaml` (ServiceAccount + Role + RoleBinding, one set
per environment via the per-overlay namespace transform). Exactly the
verbs Phase 2's deploy pipeline needs to roll out the 4 apps and nothing
else — no Secrets access (there are none to access, see
[kubernetes-architecture.md](kubernetes-architecture.md)), no RBAC
self-modification, no access to any workload outside this Role's resource
list:

```
deployments, services, ingresses, networkpolicies,
horizontalpodautoscalers, poddisruptionbudgets, verticalpodautoscalers
  -> get, list, watch, create, update, patch
pods, events
  -> get, list, watch  (read-only, to verify rollout health)
```

**Gotcha found during validation**: kustomize's `namespace:` transformer
rewrites a resource's own `metadata.namespace`, but does *not* rewrite a
RoleBinding's `subjects[].namespace` — confirmed by inspecting actual
`kubectl kustomize` output, where the ServiceAccount subject's namespace
stayed a literal `PLACEHOLDER_NAMESPACE` while everything else correctly
became `patheya-express-dev`. Each overlay now carries an explicit JSON6902
patch (`- op: replace, path: /subjects/0/namespace, value: ...`) fixing
this — see any `overlays/*/kustomization.yaml`'s trailing patch entry.

No credential for this ServiceAccount is issued or wired into any CI
system in this phase — Phase 2's job is deciding how a CI runner actually
authenticates as it (OIDC federation to the cluster is strongly preferred
over exporting a long-lived ServiceAccount token).

## 3. `patheya-frontend-viewer` — cluster-scoped role, namespace-scoped bindings

`platform/rbac/frontend-viewer-clusterrole.yaml` defines a read-only
ClusterRole (get/list/watch on pods, services, deployments, ingresses,
HPAs, PDBs, NetworkPolicies, events, configmaps — **not** Secrets, on
purpose, since read access to a Secret is as sensitive as write access to
anything else). It's deliberately a `ClusterRole` bound via a `RoleBinding`
in each namespace (`base/rbac-viewer-binding.yaml`, one per environment),
not a `ClusterRoleBinding` — that keeps the *role definition* reusable
across namespaces while keeping each *grant* scoped to only the namespaces
this platform actually owns, rather than leaking into whatever other
namespaces the backend or other teams run in the same cluster.

The binding's subject is a placeholder Group
(`patheya-express:oncall`) — grants nothing until the cluster's OIDC
provider is configured with a matching group claim. Prepared, not wired to
a real identity yet.

## 4. `metrics-server` — the one legitimate ClusterRoleBinding

`platform/metrics-server/metrics-server.yaml` includes metrics-server's
own standard RBAC: a `ClusterRole` (`system:metrics-server`, reads
`nodes/metrics` and `pods`/`nodes` cluster-wide — inherently cluster-scoped,
since node/pod metrics aren't a per-namespace concept) bound via a real
`ClusterRoleBinding`, plus the standard `system:auth-delegator` binding
and `extension-apiserver-authentication-reader` RoleBinding every
aggregated API server needs. This is the one place a `ClusterRoleBinding`
is actually the correct tool, rather than the namespace-scoped pattern
used everywhere else in this guide.

## Summary table

| Identity | Scope | Kind | Permissions |
|---|---|---|---|
| `<app>` (x4) | Pod | ServiceAccount, no Role | None — token not even mounted |
| `ci-deployer` | Namespace (x3 envs) | ServiceAccount + Role + RoleBinding | CRUD on this platform's own resource kinds only |
| `patheya-frontend-viewer` | Cluster role, namespace bindings | ClusterRole + RoleBinding (x3+ envs) | Read-only, no Secrets |
| `metrics-server` | Cluster | ServiceAccount + ClusterRole + ClusterRoleBinding | Cluster-wide metrics read (inherent to the tool) |
