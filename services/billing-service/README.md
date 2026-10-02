# billing-service

## W12 A4-P1-A — Headless certification (wave-12 audit remediation)

`GET /health` and `GET /metrics` (`src/routes/healthCheckRoute.ts`,
`src/routes/metricsRoute.ts`) are certified HEADLESS: infrastructure probe/scrape
endpoints consumed by k8s/APISIX/Prometheus, not operator workflows.

All operator routes under `/billing/*` are UI-wired via the tenant_admin Billing
Engine Control Tower (`/billing-engine`, `src/pages/BillingEngineWorkspace.tsx`
calling through `/billings/*` APISIX prefixes in `src/lib/platform.ts`).
Signed: wave-12 A4-P1-A fixer.
