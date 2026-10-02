# Deploy-plane note (OR-25)

The 520 flat manifests in `services/` are a **plain-k8s deploy plane**: none of
them carry `dapr.io/*` annotations, so pods deployed from here run **without a
Dapr sidecar**.

The Dapr-based money plane — `payment-processing-service`, `transaction-ledger`,
`audit-service`, `data-intelligence`, `payment-hub`, `mojaloop-connector`,
`erpnext-integration-service` — has **no manifest in this directory at all**.
Those services are deployed via the Helm charts under `infrastructure/charts/`
(service-group charts such as `core-payments`, which render the
`dapr.io/enabled: "true"` annotations). Helm is their deploy plane.

Operational consequence (OR-09/OR-25): the Python Dapr services read
`DAPR_PUBSUB_NAME` (`utils/config.py`, default `""`). That env **must** be set
to `pubsub` in the Helm-rendered Deployment for the pub/sub code paths to work;
with the empty default every `publish_event`/`subscribe` call targets an empty
component name and fails at runtime. The Kafka-backed Dapr components live in
`infrastructure/new/dapr/components/` (namespace `54bank`).
