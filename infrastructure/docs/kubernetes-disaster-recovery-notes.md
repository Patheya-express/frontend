# Kubernetes Disaster Recovery Notes

Companion to Phase 0's [disaster-recovery.md](disaster-recovery.md), which
covers image/DNS/rollback recovery in general. This note covers what's
specific to the Kubernetes platform layer built in this phase.

## Nothing here is stateful

Same conclusion as Phase 0, reinforced by this phase's own review: no
PersistentVolumeClaim exists for any app (see
[kubernetes-architecture.md](kubernetes-architecture.md)'s Configuration &
Secrets section for why none is appropriate), so there is no volume data
to back up, restore, or lose. Every object this phase adds —
NetworkPolicies, RBAC, PDBs, HPAs, ResourceQuotas — is fully declarative
and reproducible from git via `kubectl apply -k`.

## Recovering from a bad rollout

The Deployment's own `RollingUpdate` strategy (`maxUnavailable: 0`) means
a bad image never even fully replaces the old one — old replicas keep
serving until new ones pass `readinessProbe`. If a bad rollout somehow
does pass its probes but is behaviorally broken:

```bash
kubectl rollout undo deployment/customer-app -n patheya-express-prod
```

`revisionHistoryLimit: 5` on every Deployment keeps the last 5 ReplicaSets
around specifically so this command has somewhere to roll back to.

## Recovering from an accidentally-applied NetworkPolicy or RBAC change

Both are declarative and namespace/cluster-scoped, not workload state —
recovery is `git revert` + `kubectl apply -k` on the affected overlay or
`platform/`, same as any other manifest. The one operational risk worth
naming explicitly: **a NetworkPolicy misconfiguration can silently cut off
legitimate traffic** (the pod stays "Running" and "Ready" — NetworkPolicy
enforcement isn't visible in pod status at all). If ingress traffic
suddenly 5xxs or times out platform-wide right after a NetworkPolicy
change, suspect the policy before suspecting the application.

## Recovering the platform layer itself

If `patheya-system`/`ingress`/`monitoring` namespaces or their contents
are lost (e.g. an accidental `kubectl delete namespace`):

```bash
kubectl apply -k infrastructure/kubernetes/platform
```

recreates every namespace, PriorityClass, ClusterRole, and the
metrics-server/cert-manager/ExternalDNS manifests from source. cert-manager
itself (the controller, not the `ClusterIssuer` objects this repo owns)
and the actual Ingress controller are external installs (Helm) — see
[`../kubernetes/platform/README.md`](../kubernetes/platform/README.md) —
and need reinstalling first, in the same order as a fresh cluster bring-up.

## What full cluster loss looks like with this platform layer

Unchanged in substance from Phase 0's
[disaster-recovery.md](disaster-recovery.md) "Full cluster/region loss"
section — provision the cluster, `terraform apply` for DNS/ACM, then:

```bash
kubectl apply -k infrastructure/kubernetes/platform
kubectl apply -k infrastructure/kubernetes/overlays/production
```

recreates the entire platform and app layer from git, in order, with
nothing to restore beyond that — reinforcing why this phase treated
"nothing here is stateful" as worth confirming explicitly rather than
assuming: it makes full-cluster recovery a manifest-apply operation
instead of a backup-restore operation.

## Known gap: no live validation was possible in this environment

`kubectl apply --dry-run=server` requires a reachable API server; this
environment has no cluster configured (`kubectl config get-contexts`
returns empty), confirmed by testing rather than assumed. Everything in
this phase was validated via `kubectl kustomize` (structural/YAML
correctness, correct per-environment values) and manual review, but never
against a real cluster's admission controllers, CRD schemas (VPA,
ClusterIssuer, ExternalSecret), or Pod Security Admission enforcement.
**Phase 2's first action against a real cluster should be `kubectl apply
--dry-run=server -k` against every overlay before the first real apply**,
to catch anything a schema-blind offline build couldn't.
