# CI Foundation

GitHub Actions only executes workflows placed under `.github/workflows/` at
the repository root — that's where the real, running pipelines live:

| Workflow | Triggers | What it does |
|---|---|---|
| [`ci.yml`](../../.github/workflows/ci.yml) | PR, push to `main` | `nx affected` lint, test, and a full production build of all four apps |
| [`docker-build.yml`](../../.github/workflows/docker-build.yml) | PR, push to `main` | Builds all four container images; on PR, also runs each image and checks `/healthz`; on `main`, pushes to GHCR tagged with the commit SHA |
| [`security-scan.yml`](../../.github/workflows/security-scan.yml) | PR, push to `main`, weekly schedule | `pnpm audit`, Trivy filesystem scan, Trivy image scan — findings uploaded to the repo's Security tab |

This `infrastructure/ci/` directory is the *foundation* referenced by
Phase 0 — reusable pieces that don't belong inside a single workflow file
live here as the pipelines grow (composite actions, shared scripts). Today
it holds:

- `github-actions/` — reserved for composite actions shared across the
  three workflows above, once there's enough duplication between them to
  justify extracting one (there isn't yet).

## Deliberately not implemented yet

**Deployment.** No workflow in this repo applies a Kubernetes manifest,
runs `terraform apply`, or otherwise pushes a build to a running
environment. `infrastructure/kubernetes` and `infrastructure/terraform`
are ready to be driven by a future `deploy.yml`, but wiring that up means
deciding on a real cluster/cloud account, an approval gate, and a rollback
strategy — explicitly out of scope for this phase. When that's ready, it
should:

1. Trigger on a pushed tag or a manual `workflow_dispatch`, never on every
   push to `main`.
2. Reuse the images `docker-build.yml` already pushes to GHCR rather than
   rebuilding.
3. Apply `infrastructure/kubernetes/overlays/<environment>` via
   `kubectl apply -k` (or `kustomize build | kubectl apply -f -`) against a
   cluster reached through an OIDC-federated credential, not a long-lived
   static kubeconfig secret.
