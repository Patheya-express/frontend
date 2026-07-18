# Network Policy Guide

## Zero-trust baseline

`base/default-deny-all.yaml` selects every pod in whatever namespace it
lands in (`podSelector: {}`) and permits nothing (`policyTypes: [Ingress,
Egress]`, no rules). Kubernetes NetworkPolicies are additive — a pod
matched by multiple policies gets the union of everything each one
allows — so this is the floor every app's own policy adds exceptions to,
not something each app's policy has to re-declare.

**Without at least one NetworkPolicy selecting a pod, that pod is
unrestricted by default.** This is what actually turns that default off —
a NetworkPolicy CRD existing in a namespace doesn't restrict pods it
doesn't select.

## Per-app allow-list

`base/<app>/networkpolicy.yaml`, identical shape for all four apps:

**Ingress** — exactly two sources allowed:
1. From the `ingress` namespace (matched via the automatic
   `kubernetes.io/metadata.name` label every namespace carries since
   Kubernetes 1.21 — no manual labeling to remember), port 8080 (the app).
2. From the `monitoring` namespace, port 9113 (the metrics-exporter
   sidecar).

**Egress** — exactly one destination allowed: CoreDNS (`k8s-app: kube-dns`
pods, ports 53/UDP and 53/TCP), in any namespace. Nothing else, because
these apps genuinely have nothing else to call — the browser calls the
backend directly (see [infrastructure-overview.md](infrastructure-overview.md)),
not the pod. A pod that somehow gets compromised has no egress path to
exfiltrate anything through except DNS lookups, and no ingress path except
from the Ingress controller and Prometheus.

## Why this is safe to apply without breaking anything today

Every actual traffic path in this platform is already covered:

| Traffic | Allowed by |
|---|---|
| User's browser -> Ingress -> app pod | Ingress rule #1 |
| Prometheus -> metrics-exporter sidecar | Ingress rule #2 |
| Pod's own DNS resolution (kubelet health checks, etc.) | Egress rule |
| App pod -> anything else | **Denied** — and nothing needs it to work |

## What this does NOT cover (by design, not gap)

- **Pod -> backend API calls.** There are none — see
  [infrastructure-overview.md](infrastructure-overview.md). If a future
  phase ever needs server-side calls from a frontend pod to the backend
  (contrary to the current architecture), that would need an explicit new
  egress rule to the backend's namespace — don't add one speculatively.
- **Ingress controller's own NetworkPolicy.** Not this repo's to define —
  the `ingress` namespace (`platform/namespaces/ingress.yaml`) houses a
  controller installed and configured independently (see
  [`../kubernetes/platform/README.md`](../kubernetes/platform/README.md)).

## Requires a CNI that enforces NetworkPolicy

NetworkPolicy objects are inert on a CNI that doesn't implement the API
(the default `kubenet` doesn't; Calico, Cilium, and every major managed
Kubernetes CNI does). `kubectl kustomize` renders and validates these
objects regardless — enforcement is a cluster capability decided at
cluster-provisioning time, out of this repo's scope (see
[`../terraform/README.md`](../terraform/README.md)).
