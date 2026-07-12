# fraud-service production foundation

This file was generated during the manual production-readiness pass to standardize the minimum deployment contract for **fraud-service**.

| Capability | Status |
| --- | --- |
| Seeded data | `seed_data.json` |
| Smoke coverage | `tests/smoke/test_fraud_service_smoke.py` |
| Kubernetes base manifest | `k8s/base/fraud-service.yaml` |
| Languages detected | python, rust |

The next service-specific implementation step should focus on domain rules, middleware integration, and workflow behavior rather than basic deployment scaffolding.
