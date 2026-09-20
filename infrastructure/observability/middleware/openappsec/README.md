# OpenAppSec — log/alert forwarding (no OTel traces)

## Honest limitation (read first)

**open-appsec (Check Point nano agent) has no OpenTelemetry trace or metrics
support.** Verified-static as of this wave: the agent's observability surface
is its security-event/audit log output (file, syslog/CEF/JSON, or its cloud
management); there is no OTLP exporter. Re-check against the actually deployed
agent version — this cannot be verified from the tree because **no open-appsec
agent Deployment exists in the repo** (only the in-house `openappsec-waf-rs`
service and `security-waf` chart, which are separate components).

## What this integration provides

| File | Purpose | Status |
|---|---|---|
| `vector-openappsec.yaml` | Vector aggregator (ConfigMap + Deployment + Service, ns `observability`) receiving open-appsec security events via syslog TCP/UDP :5514, normalizing to JSON, pushing to **Loki** with labels `service=openappsec`, `severity`, `tenant_id` (when present) | requires-deployment |

Pipeline:

```
open-appsec agent (syslog target: vector-openappsec.observability:5514)
  → Vector (parse JSON, normalize severity)
  → Loki (http://loki.observability:3100)
  → Grafana: Loki alert rules (e.g. count by (severity) of critical events)
```

## Grafana alerting hook (handoff to B2)

Suggested Loki-backed alert (owned by B2's rules provisioning, included here
as guidance only — do NOT duplicate in B2's rule files without coordination):

```yaml
# expr: sum by (severity) (count_over_time({service="openappsec"} |= "Prevent" [5m])) > 0
# labels: { team: security, source: openappsec }
```

## Agent-side configuration (requires-deployment)

In the open-appsec local management/policy, set the log trigger/logger
destination to syslog `vector-openappsec.observability.svc.cluster.local:5514`
(format JSON preferred; CEF also accepted). Exact key names depend on the
deployed agent version — verify against the vendor docs for that version.

## Limitations

- No traces, no metrics from open-appsec — ever, until the vendor adds OTel.
- `tenant_id` labels appear only when the agent event actually carries a
  tenant field (usually absent) — per-tenant WAF alerting is best-effort.
- Vector version pinned as an example (`0.37.0-debian`); platform team should
  re-pin per policy.
