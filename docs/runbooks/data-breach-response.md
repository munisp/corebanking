# Runbook: Data Breach Response (NDPR)
## Severity: P0
## Trigger: Manual detection or `SecurityBreachDetected` alert

### NDPR Requirements
- **72 hours**: Notify NITDA (Nigeria Information Technology Development Agency)
- **Immediately**: Assess scope and contain breach

### Response Steps
1. **Contain** (0-1 hour)
   - Identify compromised service(s)
   - Isolate affected systems (network segmentation)
   - Revoke compromised credentials
   - Enable enhanced logging

2. **Assess** (1-4 hours)
   - Determine what data was accessed (PII categories)
   - Count affected data subjects
   - Identify attack vector
   - Preserve forensic evidence

3. **Notify** (within 72 hours)
   - File NITDA breach notification form
   - Notify affected data subjects if high risk
   - Inform CBN if financial data involved
   - Legal team review

4. **Remediate** (ongoing)
   - Patch vulnerability
   - Rotate all potentially compromised secrets
   - Enhanced monitoring for 90 days
   - Update DPIA
   - Conduct post-incident review
