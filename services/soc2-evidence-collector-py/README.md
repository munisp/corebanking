# soc2-evidence-collector-py

Automated SOC 2 evidence collection service. Gathers control-evidence records and
payment-evidence records on a schedule for auditor export.

## W12 A4-P1-A — Headless certification (wave-12 audit remediation)

The following gateway-exposed routes (`/soc2-evidence-collector/*` via
`soc2-evidence-collector-py.yaml`) are certified HEADLESS — pure machine/ops
endpoints with no human-operator workflow:

| Route | Purpose |
|---|---|
| `GET /api/v1/evidence` | Evidence record feed for the compliance data-lake |
| `POST /api/v1/evidence/collect` | Trigger an evidence collection run (scheduler/CI) |
| `GET /api/v1/payments` | Payment-evidence record feed |
| `POST /api/v1/payments` | Ingest a payment-evidence record (pipeline writer) |
| `GET/PUT/DELETE /api/v1/payments/{record_id}` | Record-level maintenance (ops tooling) |

Justification: evidence collection is consumed by the compliance pipeline and
external auditors' export jobs, not by bank operators in a UI. Signed: wave-12
A4-P1-A fixer.
