# Monitoring

Each app container ships with an `nginx-prometheus-exporter` sidecar
reading nginx's `stub_status` module over the pod's loopback interface
(see `infrastructure/kubernetes/base/*/deployment.yaml` and
`infrastructure/docker/nginx/app.conf.template`) and exposing it as
Prometheus text format on `:9113/metrics`. Pods are annotated
`prometheus.io/scrape=true` for discovery.

| File | Purpose |
|---|---|
| `prometheus/prometheus.yml` | Reference scrape config using Kubernetes pod annotation discovery (no Prometheus Operator assumed) |
| `prometheus/alert-rules.yml` | Target-down, exporter-down, dropped-connections, and near-capacity alerts |
| `grafana/dashboards/frontend-fleet.json` | Per-app/per-environment connections and request-rate dashboard |

## Known limitation

`stub_status` reports connection counts and a total request count, but
**not** a per-HTTP-status-code breakdown — there's no 5xx error-rate metric
available from this setup (that needs nginx Plus or the third-party VTS
module, neither of which is worth the added image complexity for four
static SPAs). Application-level error visibility for user-facing failures
comes from the backend's own request logs and the browser
(`window.onerror` / a future RUM integration), not from nginx.

## Not provisioned here

This directory ships config, not infrastructure — no Prometheus or Grafana
server is deployed by this repo. Point an existing cluster's Prometheus at
`prometheus.yml`'s scrape config (or convert it to a `PodMonitor` if the
cluster runs the Prometheus Operator) and import the dashboard JSON into an
existing Grafana instance. See `infrastructure/terraform/README.md` for why
cluster-level tooling is intentionally out of this repo's scope.
