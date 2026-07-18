# Infrastructure Documentation

## Phase 0 — Infrastructure Foundation

| Guide | Covers |
|---|---|
| [infrastructure-overview.md](infrastructure-overview.md) | What this repo is, directory map, how a request flows, what's in vs. out of scope |
| [docker-guide.md](docker-guide.md) | Image design, nginx config, compose files, validation results |
| [environment-guide.md](environment-guide.md) | Infra `.env` files vs. Angular's own build-time environments, validation |
| [secrets-guide.md](secrets-guide.md) | Why this frontend has no runtime secrets, and what infra secrets do exist |
| [production-guide.md](production-guide.md) | Compression, security headers, rate limiting, graceful shutdown, logging, hardening |
| [disaster-recovery.md](disaster-recovery.md) | RTO/RPO, rollback procedure, full cluster loss |
| [local-development-guide.md](local-development-guide.md) | Day-to-day dev loop, running the backend alongside it |

## Phase 1 — Enterprise Kubernetes Platform

| Guide | Covers |
|---|---|
| [kubernetes-architecture.md](kubernetes-architecture.md) | platform/ vs. base+overlays, per-app resource set, Config/Secrets/Storage decisions |
| [deployment-guide.md](deployment-guide.md) | Rolling updates, probe stack, graceful termination, scheduling (affinity/priority/spread) |
| [namespace-guide.md](namespace-guide.md) | The 6 namespaces, naming rationale, Pod Security Admission levels, apply order |
| [autoscaling-guide.md](autoscaling-guide.md) | HPA/VPA design, min/max replicas and rationale per environment, expected scaling behavior |
| [rbac-guide.md](rbac-guide.md) | The 4 identities (per-app SA, ci-deployer, viewer, metrics-server) and why each is scoped the way it is |
| [network-policy-guide.md](network-policy-guide.md) | Zero-trust default-deny + per-app allow-list, what it does and doesn't cover |
| [ingress-guide.md](ingress-guide.md) | TLS/cert-manager, WebSocket headroom, rate limiting, why compression/headers aren't duplicated at the edge |
| [kubernetes-disaster-recovery-notes.md](kubernetes-disaster-recovery-notes.md) | Platform-layer-specific recovery (rollout undo, NetworkPolicy/RBAC recovery, known validation gap) |

See also [`../ci/README.md`](../ci/README.md),
[`../terraform/README.md`](../terraform/README.md),
[`../monitoring/README.md`](../monitoring/README.md), and
[`../kubernetes/platform/README.md`](../kubernetes/platform/README.md) for
those subsystems' own scope notes.
