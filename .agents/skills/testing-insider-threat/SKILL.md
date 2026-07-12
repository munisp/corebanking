---
name: testing-insider-threat
description: Test 54Bank insider threat mitigation controls (12 services across 6 defense layers). Use when verifying PAM, UEBA, DLP, canary tokens, self-dealing detection, velocity limits, session recording, break-glass, credential rotation, code signing, dormant account monitoring, or GL reconciliation changes.
---

# Testing 54Bank Insider Threat Controls

## Prerequisites

- Go 1.21+ (for compiling 6 Go services)
- Rust/Cargo (for compiling 3 Rust services — first build takes ~2 min per service)
- Python 3.12+ with `pyyaml` (for 3 Python services + K8s manifest validation)
- No Kafka/Postgres/Redis needed — services run with in-memory state for testing

## Devin Secrets Needed

None — all testing is local (compile + start services + curl endpoints).

## Service Port Map

Start each service with `PORT=<port>` env var:

| Port | Service | Lang |
|------|---------|------|
| 9001 | privileged-access-go | Go |
| 9002 | break-glass-go | Go |
| 9003 | canary-token-go | Go |
| 9004 | session-recorder-go | Go |
| 9005 | employee-velocity-go | Go |
| 9006 | dlp-gateway-go | Go |
| 9011 | ueba-analytics-py | Python |
| 9012 | dormant-account-monitor-py | Python |
| 9013 | gl-reconciliation-alerts-py | Python |
| 9021 | self-dealing-detector-rs | Rust |
| 9022 | credential-rotation-rs | Rust |
| 9023 | code-signing-rs | Rust |

## Testing Procedure

### Phase 1: Compilation

```bash
# Go (fast — ~5s each)
for svc in privileged-access-go break-glass-go canary-token-go session-recorder-go employee-velocity-go dlp-gateway-go; do
  cd services/$svc && go mod tidy && CGO_ENABLED=0 go build -o /tmp/test-$svc . && cd ../..
done

# Rust (slow — ~2 min each for first build, use cargo build --release)
for svc in code-signing-rs self-dealing-detector-rs credential-rotation-rs; do
  cd services/$svc && cargo build --release && cd ../..
done

# Python (instant)
for svc in ueba-analytics-py dormant-account-monitor-py gl-reconciliation-alerts-py; do
  python3 -c "import py_compile; py_compile.compile('services/$svc/main.py', doraise=True)"
done
```

### Phase 2: K8s Manifest Validation

All 12 manifests in `k8s/insider-threat/` should have exactly 4 YAML documents: Deployment, Service, PodDisruptionBudget, HorizontalPodAutoscaler.

```python
import yaml, os
for f in sorted(os.listdir('k8s/insider-threat')):
    docs = [d for d in yaml.safe_load_all(open(f'k8s/insider-threat/{f}')) if d]
    kinds = [d['kind'] for d in docs]
    assert len(docs) == 4, f"{f}: expected 4 docs, got {len(docs)}"
```

### Phase 3: Health Endpoints

All services expose `/healthz`, `/livez`, `/readyz`. Start them in background with unique ports, then curl each.

### Phase 4: Adversarial Domain Logic Tests

Key API contracts and gotchas:

#### PAM (port 9001)
- **Create request**: POST `/api/v1/pam/request` — MUST include `justification` with incident/ticket reference (e.g. "INC-2026-XXXX"). Without it, returns 400.
- **Self-approval**: POST `/api/v1/pam/approve` with same `approver_id` as `requestor_id` → 403
- **Dual-approval**: First unique approver → 200 (1/2). Duplicate → 400. Second unique → 200 with status `"active"` and `session_token`.

#### Canary Tokens (port 9003)
- **Uses GET query params**, not POST body: `GET /api/v1/canary/check?resource=NUBAN-0000000099&actor_id=emp-test`
- Pre-seeded canaries: `NUBAN-0000000099`, `NUBAN-0000000098`, `sk_canary_xf9k2m`, `customer:CUST-CANARY-HNW`, `/exports/salary_export_2026.csv`

#### DLP (port 9006)
- POST `/api/v1/dlp/check` — field names: `actor_id`, `operation`, `record_count`, `data_bytes`, `pii_count`
- Threshold: 10K records → block. Test with 15K (should 403) and 500 (should 200).

#### Self-Dealing (port 9021, Rust)
- First register a link: POST `/api/v1/self-dealing/register` with `employee_id`, `account_id`, `relationship`
- Then check: POST `/api/v1/self-dealing/check` — requires `transaction_ref` field alongside `employee_id`, `source_account`, `dest_account`, `amount_kobo`

#### Velocity (port 9005)
- POST `/api/v1/velocity/check` with `employee_id`, `role`, `amount_kobo`, `txn_type`
- Teller 1H limit is 50 transactions. Flood with 55+ to trigger violation.

#### GL Reconciliation (port 9013)
- POST `/api/v1/gl-recon/check-balance` with `total_debits_kobo`, `total_credits_kobo`, `account_count`
- POST `/api/v1/gl-recon/check-journal` — suspense accounts: `9999001`, `9999002`, `9999003`, `SUSPENSE`, `SUNDRY`

#### UEBA (port 9011)
- Must seed baseline first: POST `/api/v1/ueba/seed-baseline`
- Then analyze: POST `/api/v1/ueba/analyze-login` with `hour`, `ip`, `device_id`

#### Dormant Account (port 9012)
- Pre-seeded accounts: ACCT-D001 (400d), ACCT-D002 (250d), ACCT-D003 (720d), ACCT-D004 (190d), ACCT-D005 (550d)
- Shows `DeprecationWarning` for `datetime.utcnow()` — cosmetic, does not affect functionality

#### Credential Rotation (port 9022, Rust)
- GET `/api/v1/credentials/stale` — should return at least 2 stale credentials

#### Code Signing (port 9023, Rust)
- POST `/api/v1/signing/verify` with `artifact_id`, `sha256_hash` → 403 for unsigned artifacts

## Shell-Only Testing

All testing is shell-only — no browser/desktop recording needed. Use exec tool for all commands.

## Common Issues

1. **Rust first build is slow** (~2 min per service due to actix-web compilation). Subsequent builds are fast.
2. **Python deprecation warnings** for `datetime.utcnow()` are cosmetic — ignore them.
3. **PAM requires ticket reference** in justification field — plain text justifications are rejected.
4. **Canary check uses GET params** not POST body — check the handler if getting "resource required" errors.
5. **Self-dealing check requires `transaction_ref`** field — without it, Rust returns deserialization error.
6. **DLP field names** differ from the struct names: use `record_count`, `data_bytes`, `pii_count` (not `records_read`, `bytes_read`, `pii_access`).