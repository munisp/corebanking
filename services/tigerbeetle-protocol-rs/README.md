# tigerbeetle-protocol-rs

Internal TigerBeetle ledger protocol adapter. Exposes account/transfer queries and
two-phase commit/void primitives used by the ledger services.

## W12 A4-P1-A — Headless certification (wave-12 audit remediation)

The following gateway-exposed routes (`/tigerbeetle-protocol/*` via
`tigerbeetle-protocol-rs.yaml`) are certified HEADLESS — internal ledger-protocol
endpoints consumed by other services, not by human operators:

| Route | Purpose |
|---|---|
| `GET /v1/tigerbeetle/accounts` | Internal account query for ledger reconciliation jobs |
| `GET /v1/tigerbeetle/transfers` | Internal transfer query for ledger reconciliation jobs |
| `POST /v1/tigerbeetle/transfers` | Protocol-level transfer creation (service-to-service) |
| `POST /v1/tigerbeetle/commit` | Two-phase commit of a pending transfer (service-to-service) |
| `POST /v1/tigerbeetle/void` | Void of a pending transfer (service-to-service) |
| `GET /v1/alerts` | Ops alerting feed (Prometheus/alertmanager) |

Justification: these are machine-to-machine ledger primitives invoked by the
tigerbeetle adapter/ledger services; no bank operator performs these actions in a
UI. Signed: wave-12 A4-P1-A fixer.
