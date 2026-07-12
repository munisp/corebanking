# Runbook: High Error Rate (>5%)
## Severity: P1
## Trigger: `HighErrorRate5xx` alert fires

### Triage Steps
1. Check Grafana dashboard: Platform Overview → Error Rate panel
2. Identify which service(s) have elevated errors: `sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)`
3. Check if correlated with deployment: `kubectl rollout history deployment/<service>`

### Common Causes
- **Database connection exhaustion**: Check `pg_stat_activity` for idle connections
- **Downstream service failure**: Check circuit breaker state
- **Memory pressure**: Check container OOM kills `kubectl get events --field-selector reason=OOMKilled`
- **Bad deployment**: Recent code change introduced bug

### Resolution
1. If deployment-related: `kubectl rollout undo deployment/<service>`
2. If DB connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < NOW() - INTERVAL '5 minutes'`
3. If memory: Scale horizontally `kubectl scale deployment/<service> --replicas=<n+2>`
4. If downstream: Check circuit breaker, enable fallback mode

### Escalation
- 15 min unresolved → Page on-call SRE
- 30 min unresolved → Page engineering manager
- Revenue-impacting → Incident commander declares SEV1
