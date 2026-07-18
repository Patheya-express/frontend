# Kubernetes Architecture

## Two layers

```
infrastructure/kubernetes/
├── platform/    cluster-wide, applied once, independent of environment
└── kustomize base + overlays, applied per environment
    ├── base/                    shared definition of the 4 apps
    └── overlays/{development,staging,production}/
```

`platform/` and the app layer are applied separately and in order — see
[`infrastructure/kubernetes/platform/README.md`](../kubernetes/platform/README.md)
for exactly why (the app overlays reference platform objects by name:
PriorityClasses, a ClusterRole).

## The app layer, per app

Each of `customer-app`, `restaurant-app`, `admin-app`, `delivery-app` gets
an identical resource set in `base/<app>/`:

| File | Kind | Purpose |
|---|---|---|
| `deployment.yaml` | Deployment | The nginx pod + metrics-exporter sidecar (Phase 0) |
| `service.yaml` | Service | ClusterIP, routed to by Ingress |
| `hpa.yaml` | HorizontalPodAutoscaler | CPU + memory scaling — see [autoscaling-guide.md](autoscaling-guide.md) |
| `ingress.yaml` | Ingress | TLS, host routing — see [ingress-guide.md](ingress-guide.md) |
| `serviceaccount.yaml` | ServiceAccount | Dedicated, no permissions — see [rbac-guide.md](rbac-guide.md) |
| `pdb.yaml` | PodDisruptionBudget | `minAvailable: 50%` |
| `vpa.yaml` | VerticalPodAutoscaler | Recommendation-only (`updateMode: Off`) |
| `networkpolicy.yaml` | NetworkPolicy | Explicit allow-list — see [network-policy-guide.md](network-policy-guide.md) |

Every app's files are generated from the same canonical template
(`customer-app/`) via a scripted `sed` substitution — a deliberate,
established pattern carried over from Phase 0 rather than a kustomize
`components:` abstraction, so all four apps stay provably identical except
for name/host/priority, and any reviewer can diff two apps' files directly
instead of reasoning through a templating layer.

## Why VPA and HPA coexist without fighting

Both target the same Deployment, but VPA's `updateMode: "Off"` means it
only writes a recommendation to its own `.status` — it never resizes a
running pod or evicts anything. Running VPA in `"Auto"` mode alongside an
HPA on the same resource (CPU/memory) is a well-known anti-pattern: VPA
would fight the HPA by changing the metric the HPA scales on out from
under it. Revisit only once there's enough recommendation history to trust
(`kubectl describe vpa <app>`), and even then, only if VPA's newer in-place
resize support covers it cleanly.

## Configuration & Secrets

**No ConfigMap exists for any app**, by design, not oversight: nginx's
entire configuration (`infrastructure/docker/nginx/*.conf`) is baked into
the image at build time (Phase 0, frozen) rather than mounted at runtime.
Moving it to a ConfigMap would mean either (a) the image no longer being
self-contained/reproducible independent of the cluster, or (b) maintaining
the same config in two places. If a genuine runtime-tunable setting
appears later, the three categories to sort it into are:

- **Application config** (per-app behavior) — still likely stays a build
  arg, given Angular's own `environment.*.ts` files already own this for
  the app itself (see Phase 0's
  [environment-guide.md](environment-guide.md)).
- **Infrastructure config** (nginx tuning, timeouts) — would become a
  ConfigMap mounted over `/etc/nginx/conf.d/`, replacing the image-baked
  copy.
- **Environment config** (per-namespace values) — a kustomize
  `configMapGenerator` in the relevant overlay.

**No Secret exists for any app**, because none of the four apps has a
secret to hold — every value in an Angular environment file ends up in the
public browser bundle by construction (see Phase 0's
[secrets-guide.md](secrets-guide.md)). `infrastructure/kubernetes/platform/external-secrets/`
holds a worked, non-applied example of the External Secrets Operator +
AWS Secrets Manager pattern to use the day that stops being true.

**No PersistentVolumeClaim exists for any app**, because none needs
one — every app is a stateless static file server; the only paths its
nginx process ever writes to (`/tmp`, `/var/cache/nginx`, `/var/run`) are
`emptyDir` volumes, torn down with the pod on purpose (Phase 0). A PVC
would be appropriate the day a workload needs data to outlive its pod,
which describes none of the four apps today.

## Validation performed

`kubectl kustomize` against `platform/` and all three overlays, plus a
duplicate-resource check (kind+namespace+name) across every rendered
manifest set — see the Validation Results section of the Phase 1 report
for exact counts. A live-cluster `kubectl apply --dry-run=server` was not
possible in this environment (no cluster configured, confirmed by testing
— see [disaster-recovery-notes.md](kubernetes-disaster-recovery-notes.md)
for what that means for pre-deploy validation in Phase 2).
