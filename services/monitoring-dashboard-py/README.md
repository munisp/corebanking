# Monitoring Dashboard Service
Aggregates platform health, SLA metrics, KEDA status, and alert management.

## Endpoints
- GET `/v1/monitoring/platform-status` — Full platform health overview
- GET `/v1/monitoring/alerts` — Active and historical alerts
- GET `/v1/monitoring/sla` — SLA compliance metrics
- GET `/v1/monitoring/keda` — KEDA autoscaler status
- POST `/v1/monitoring/report-health` — Service health report
- POST `/v1/monitoring/acknowledge-alert` — Acknowledge alert
