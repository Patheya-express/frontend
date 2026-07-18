# Ingress Guide

## TLS and multiple hosts

Each app's `ingress.yaml` terminates TLS for its own host
(`{customer,restaurant,admin,delivery}.patheyaexpress.example` in
production; `{dev,staging}.<app>.patheyaexpress.example` in the other two
environments — see each overlay's JSON6902 host patches). Four separate
Ingress objects rather than one Ingress with four host rules, so each
app's routing config can be reasoned about (and changed) independently —
a change to `customer-app`'s Ingress can't accidentally affect
`admin-app`'s.

## cert-manager integration

`cert-manager.io/cluster-issuer` annotation, defaulting to
`letsencrypt-staging` in the base manifest — **production's overlay is the
only one that patches it to `letsencrypt-production`** (see
[`../kubernetes/overlays/production/kustomization.yaml`](../kubernetes/overlays/production/kustomization.yaml)).
This was a deliberate safe-by-default choice: staging's ACME environment
has no rate limit and issues certificates no browser trusts, exactly right
for iterating on ingress config; production's has a real, low weekly rate
limit per domain. Defaulting to production everywhere would risk burning
that limit during ordinary dev/staging testing.

cert-manager's **ingress-shim** reads this annotation directly off the
Ingress and creates the Certificate object automatically — see
[`../kubernetes/platform/cert-manager/README.md`](../kubernetes/platform/cert-manager/README.md)
for why no separate `Certificate` resource exists in this repo.

## WebSocket compatibility

`nginx.ingress.kubernetes.io/proxy-read-timeout` /
`proxy-send-timeout: "3600"` — nginx-ingress's default 60-second proxy
timeout is tuned for ordinary request/response HTTP, not a held-open
connection. None of the four apps has a WebSocket endpoint of their own
today (Socket.IO is served by the backend directly — see
[infrastructure-overview.md](infrastructure-overview.md)), so this is
forward-compatible headroom, not something currently exercised.

## Rewrite rules

Not used. Every app's routing is a single `path: /, pathType: Prefix`
forwarding every request as-is — the SPA fallback that maps arbitrary
sub-paths to `/index.html` already happens inside nginx itself
(`infrastructure/docker/nginx/app.conf.template`, Phase 0), so the Ingress
has nothing left to rewrite. If a future app under this Ingress class ever
needs path rewriting (e.g. stripping a prefix before forwarding),
`nginx.ingress.kubernetes.io/rewrite-target` is the annotation to reach
for — deliberately not added speculatively here.

## Rate limiting

`nginx.ingress.kubernetes.io/limit-rps: "100"` and
`limit-connections: "50"` — per-client-IP, enforced at the load balancer
edge, independent of and in addition to each pod's own
`limit_req_zone` (`infrastructure/docker/nginx/nginx.conf`, Phase 0). Two
layers because they protect against different things: the Ingress-level
limit protects the cluster's ingress capacity itself; the pod-level limit
protects one pod from one misbehaving connection regardless of how it got
routed there.

## Compression and security headers — deliberately NOT set here

Every pod behind these Ingress objects already gzips
(`infrastructure/docker/nginx/nginx.conf`) and sets the full security
header set (`security-headers.conf`) itself — Phase 0, frozen. Adding
either again at the Ingress layer via `configuration-snippet` would risk
doubled `Content-Encoding` handling or duplicate/conflicting header
values, not add any protection a client-facing browser would see
differently. This was a conscious decision, not an oversight — see
[production-guide.md](production-guide.md) for the pod-level
implementation these would duplicate.

## Validated

`kubectl kustomize` against all three overlays confirms: correct
per-environment host and TLS `hosts[]` values, correct per-environment
`cluster-issuer` (staging in dev/staging, production in production only),
and no duplicate Ingress objects across the rendered manifest set (see the
Phase 1 report's Validation Results).
