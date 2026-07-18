# Terraform Foundation

## Scope

Compute for all four frontend apps is delegated to Kubernetes
(`infrastructure/kubernetes`) — Deployments, Services, HPAs, and Ingress
resources are managed via `kubectl apply -k`, not Terraform. What Terraform
owns instead is the infrastructure a Kubernetes Ingress alone can't create
for itself: **DNS records and the TLS certificate they resolve to.**

This is deliberately narrow. Provisioning the Kubernetes cluster itself
(VPC, node groups, IAM/OIDC for CI) is a platform-level decision — which
cloud, which region, shared with the backend or standalone — that hasn't
been made yet and belongs to whoever owns `patheya-express-platform`'s
infrastructure, not this frontend repo. Wiring that up prematurely here
would mean guessing account IDs and network layout that don't exist.
`modules/frontend-hosting` and the three environment roots below are real,
working Terraform — just scoped to what this repo can actually decide on
its own: its own subdomains.

## Layout

```
terraform/
├── modules/
│   └── frontend-hosting/     # Route53 records + ACM certificate for one environment's 4 subdomains
└── environments/
    ├── development/          # dev.{customer,restaurant,admin,delivery}.patheyaexpress.example
    ├── staging/               # staging.{customer,restaurant,admin,delivery}.patheyaexpress.example
    └── production/            # {customer,restaurant,admin,delivery}.patheyaexpress.example
```

Each environment root calls the `frontend-hosting` module once with its own
`terraform.tfvars` (copy `terraform.tfvars.example` — see
[environment-guide.md](../docs/environment-guide.md) for the same pattern
applied to `.env` files).

## Before running this for real

1. **Pick a cloud account and Route53 hosted zone** for
   `patheyaexpress.example` (replace with the real domain everywhere it
   appears) and put its zone ID in each environment's `terraform.tfvars`.
2. **Configure remote state** — each environment's `backend.tf` uses a
   partial backend configuration (bucket/key intentionally omitted from the
   committed file) so the real bucket name is supplied at `terraform init`
   time via `-backend-config`, never committed:
   ```
   terraform init -backend-config="bucket=<your-state-bucket>" -backend-config="dynamodb_table=<your-lock-table>"
   ```
3. **Get the Ingress controller's load balancer hostname** from the cluster
   (`kubectl get svc -n ingress-nginx ingress-nginx-controller`) and set it
   as `ingress_hostname` in `terraform.tfvars` — Terraform can't discover
   this on its own since it doesn't provision the cluster.

## What's NOT here yet (future phases)

- Cluster provisioning (EKS/GKE/AKS module, VPC, node groups)
- CI OIDC role for `terraform apply` / `kubectl apply` from GitHub Actions
- The backend's own infrastructure (database, Redis, Kafka) — owned by
  `patheya-express-platform`
