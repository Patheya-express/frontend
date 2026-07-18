# cert-manager Preparation

## What's here

`cluster-issuers.yaml` — two `ClusterIssuer` objects (`letsencrypt-staging`,
`letsencrypt-production`) that every app's Ingress
(`infrastructure/kubernetes/base/*/ingress.yaml`) already references by
name via the `cert-manager.io/cluster-issuer` annotation.

## What's NOT here, on purpose

**No `Certificate` resources.** cert-manager has two ways to get a
Certificate created: write one explicitly, or annotate an Ingress with
`cert-manager.io/cluster-issuer` and let cert-manager's **ingress-shim**
controller create one automatically from the Ingress's own `spec.tls`
block. Our Ingress manifests already use the second path — adding explicit
`Certificate` objects on top would be a second, redundant mechanism
managing the exact same `Secret` (`customer-app-tls` etc.), with no benefit
and a real risk of the two fighting each other.

**No cert-manager controller/CRDs.** Installing cert-manager itself (CRDs
+ controller, ~6 deployments) is cluster-lifecycle work, not something this
frontend repo provisions — see
[`infrastructure/terraform/README.md`](../../../terraform/README.md) for
the same reasoning applied to the cluster itself. Install it via its
official Helm chart before applying `cluster-issuers.yaml`.

## Before this does anything real

1. Install cert-manager (Helm: `cert-manager/cert-manager`, includes its
   CRDs).
2. Replace `platform@patheyaexpress.example` in `cluster-issuers.yaml`
   with a real, monitored mailbox — Let's Encrypt emails it about
   expiring certificates and API changes.
3. Confirm the nginx Ingress controller is installed and its
   `ingressClassName: nginx` matches (see
   [`../namespaces/ingress.yaml`](../namespaces/ingress.yaml)) — the HTTP01
   solver routes its challenge requests through it.
