---
name: testing-flow-of-funds
description: Test 54Bank flow-of-funds infrastructure (saga orchestration, TigerBeetle 2PC, distributed locking, transactional outbox, and bug fixes in gl-engine, payments-hub, temporal-worker). Use when verifying fund movement changes, atomicity fixes, or double-entry validation.
---

# Testing 54Bank Flow-of-Funds Infrastructure

## Prerequisites

- Go 1.21+ (for `go test -race`)
- No external services needed — all packages use in-process simulation
- No secrets needed

## Key Packages

| Package | Location | Tests | What It Tests |
|---------|----------|-------|---------------|
| `pkg/fundsaga` | Saga orchestration | 32+ | Forward execution, reverse-order compensation, double-entry validation |
| `pkg/tb2pc` | TigerBeetle 2PC | 10+ | Pending→post/void lifecycle, expiry, double-post prevention |
| `pkg/distlock` | Distributed locking | 10+ | Mutual exclusion, multi-key rollback, fencing tokens, TTL |
| `pkg/outbox` | Transactional outbox | 6+ | Append/relay, retry/DLQ, auto-relay, SQL helpers |
| `pkg/tbclient` | TigerBeetle SDK client | 7 | Real SDK wiring, Uint128 types, graceful skip without cluster |

## Step 1: Run All Package Tests with Race Detector

```bash
cd /home/ubuntu/repos/corebanking
for pkg in pkg/fundsaga pkg/tb2pc pkg/distlock pkg/outbox pkg/tbclient; do
  echo "=== $pkg ==="
  (cd $pkg && go test -v -race ./...)
done
```

**Expected**: All tests PASS, zero race conditions detected.

**Known issues**:
- `pkg/tb2pc` has a preexisting data race in `expireLoop()` at `two_phase.go:235` — verify via `git log --oneline -1 pkg/tb2pc/` that it predates your commit before dismissing.
- `pkg/distlock` might fail with go.sum checksum mismatch for go-redis/v9 — run `go mod tidy` to fix.
- If `TestAutoRelay` in `pkg/outbox` fails with a data race on `mockPublisher.published`, the fix is to add `sync.Mutex` to the mock and use a `count()` accessor instead of direct `len(pub.published)`. See PR #6.

## Step 2: Verify TigerBeetle SDK Is Real (Not Facade)

This is the **critical** step for TigerBeetle changes. A facade that reimplements TB in PostgreSQL looks correct but gives you ~10K TPS instead of 1M+ TPS.

### 2a: Dependency chain must include native library
```bash
cd /home/ubuntu/repos/corebanking/pkg/tbclient
go list -deps ./... | grep tigerbeetle
```
**Expected**: Both lines present:
```
github.com/tigerbeetle/tigerbeetle-go/native
github.com/tigerbeetle/tigerbeetle-go
```
The `/native` package proves CGo linking to TigerBeetle's C library. A facade would NOT have this.

### 2b: CGo compilation succeeds
```bash
CGO_ENABLED=1 go build -v ./...
```
**Expected**: Exit 0. If CGo fails, the native library isn't properly linked.

### 2c: Static analysis of SDK calls vs PostgreSQL queries
```bash
# Must find: real SDK calls (expect 4)
grep -c 'c\.tb\.CreateAccounts\|c\.tb\.CreateTransfers\|c\.tb\.LookupAccounts\|c\.tb\.LookupTransfers' client.go

# Must NOT find: PostgreSQL ledger queries (expect 0)
grep -c 'db\.Exec.*INSERT INTO tb_accounts\|db\.Exec.*INSERT INTO tb_transfers' client.go

# Must find: proper import
grep 'tb "github.com/tigerbeetle/tigerbeetle-go"' client.go
```

### 2d: Address validation proves real connectivity intent
```bash
unset TB_ADDRESS TIGERBEETLE_ADDRESSES
go test -v -run TestNewClientRejectsNoAddresses ./...
```
**Expected**: PASS with error message "no TigerBeetle addresses configured"

### 2e: Uint128 type system (CGo types, not Go arrays)
```bash
go test -v -run TestUint128Helpers ./...
```
**Expected**: PASS. The Uint128 type is a CGo wrapper around `C.tb_uint128_t` — it cannot be sliced like a Go array. Key patterns:
- Use `.Bytes()` to get `[16]byte` from Uint128
- Use `.Uint64()` to get `(lo, hi uint64)` from Uint128
- Use `tb.ToUint128(uint64)` for zero-value comparisons (NOT `Uint128{}`)
- Pass `[16]byte` array directly to `BytesToUint128()` (NOT a slice `[]byte`)

### 2f: Integration tests skip gracefully without cluster
```bash
unset TB_ADDRESS TIGERBEETLE_ADDRESSES
go test -v ./...
```
**Expected**: 2 PASS + 5 SKIP, overall PASS. No panic, no hang, no timeout.

## Step 3: Adversarial Double-Entry Validation

Write a Go test that creates imbalanced legs (debit ≠ credit) with `StepValidateBalances()` included:

```go
steps := []SagaStep{
    {Name: "imbalanced", Forward: func(ctx context.Context, state *SagaState) error {
        state.Legs = append(state.Legs,
            TransferLeg{AccountID: "A", Amount: 10000, Direction: "debit"},
            TransferLeg{AccountID: "B", Amount: 9000, Direction: "credit"},
        )
        return nil
    }},
    StepValidateBalances(),
}
```

**Expected**: Saga fails with "double-entry imbalance: debit=10000 credit=9000 kobo"

**Important**: `ExecuteSaga` is a generic executor — it does NOT enforce double-entry by itself. Validation is opt-in via `StepValidateBalances()`. All 20 pre-built saga pipelines include this step. If you test without it, imbalanced entries will silently pass.

## Step 4: Adversarial 2PC (Double-Spend Prevention)

```go
mgr := NewTwoPhaseCommitManager(5 * time.Minute)
pt, _ := mgr.CreatePending(NewID(100), NewID(200), 500000, 1, 1)
mgr.PostPending(pt.Transfer.ID) // first post succeeds
err := mgr.PostPending(pt.Transfer.ID) // second MUST fail
```

**Expected**: Second `PostPending` returns error "transfer already posted"

## Step 5: Adversarial Lock Mutual Exclusion

```go
mgr := NewLockManager()
mgr.Acquire("account:001", "txn-1", 30*time.Second) // succeeds
_, err := mgr.Acquire("account:001", "txn-2", 30*time.Second) // MUST fail
```

**Expected**: Error "lock account:001 held by txn-1"

## Step 6: Compile Modified Services

```bash
cd /home/ubuntu/repos/corebanking
for svc in payments-hub-go gl-engine-go temporal-worker-go tigerbeetle-sync-go middleware-go; do
  (cd services/$svc && CGO_ENABLED=0 go build -o /dev/null . && echo "PASS $svc")
done
```

**Expected**: All 5 compile with exit 0.

## Step 7: Verify Bug Fixes via Grep

```bash
# Audit log: async fire-and-forget REMOVED
grep -c 'go func.*db\.Exec.*audit' services/gl-engine-go/main.go
# Expected: 0

# Audit log: synchronous write PRESENT
grep -c 'ExecContext.*audit_trail' services/gl-engine-go/main.go
# Expected: 1

# Circuit breaker: atomic operations PRESENT
grep -c 'atomic\.\(LoadInt32\|StoreInt32\|CompareAndSwapInt32\)' services/payments-hub-go/main.go
# Expected: 5
```

## Step 8: Adversarial Persistence Tests (kill→restart→verify)

These tests prove services actually persist to PostgreSQL and survive restarts. This is the most important test for production readiness — compilation alone is NOT proof.

### Setup
```bash
# Ensure PostgreSQL is running and create test database
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'testpass';"
sudo -u postgres psql -c "CREATE DATABASE test_hardening;"
export DATABASE_URL="postgres://postgres:testpass@localhost:5432/test_hardening?sslmode=disable"
```

### Go service persistence (account-lien-go example)
```bash
cd /home/ubuntu/repos/corebanking/services/account-lien-go
CGO_ENABLED=0 go build -o /tmp/account-lien-go .
PORT=9046 DATABASE_URL="$DATABASE_URL" /tmp/account-lien-go &
PID=$!; sleep 2

# Create data
curl -s -X POST http://localhost:9046/api/v1/lien/place \
  -H "Content-Type: application/json" \
  -d '{"account_id":"ACCT-001","amount_kobo":5000000,"type":"judicial_hold","reason":"Court order","reference":"REF-001","placed_by":"tester"}'

# Kill and restart
kill $PID; sleep 1
PORT=9046 DATABASE_URL="$DATABASE_URL" /tmp/account-lien-go &
PID=$!; sleep 2

# Verify data survived
curl -s http://localhost:9046/api/v1/lien/account/ACCT-001
# Expected: JSON array containing the lien with amount_kobo=5000000
kill $PID
```

### Rust service persistence (pad-liveness-rs example)
```bash
cd /home/ubuntu/repos/corebanking/services/pad-liveness-rs
cargo build --release
PORT=9052 DATABASE_URL="$DATABASE_URL" ./target/release/pad-liveness-rs &
PID=$!; sleep 2

curl -s -X POST http://localhost:9052/api/v1/liveness/challenge \
  -H "Content-Type: application/json" \
  -d '{"session_id":"S1","user_id":"U1"}'

kill $PID; sleep 1
PORT=9052 DATABASE_URL="$DATABASE_URL" ./target/release/pad-liveness-rs &
PID=$!; sleep 2

# Verify via DB query
sudo -u postgres psql -d test_hardening -c "SELECT count(*) FROM liveness_challenges;"
# Expected: count >= 1
kill $PID
```

### Python service persistence (behavioral-biometrics-py example)
```bash
PORT=9053 DATABASE_URL="$DATABASE_URL" python3 /home/ubuntu/repos/corebanking/services/behavioral-biometrics-py/main.py &
PID=$!; sleep 2

curl -s -X POST http://localhost:9053/api/v1/behavioral/enroll \
  -H "Content-Type: application/json" \
  -d '{"user_id":"U1","keystroke_timings":[0.1,0.2],"touch_pressures":[0.5],"swipe_velocities":[100],"typing_speed_wpm":60}'

kill $PID; sleep 1
PORT=9053 DATABASE_URL="$DATABASE_URL" python3 /home/ubuntu/repos/corebanking/services/behavioral-biometrics-py/main.py &
PID=$!; sleep 2

curl -s http://localhost:9053/api/v1/behavioral/profile/U1
# Expected: JSON with "source": "postgresql"
kill $PID
```

## Step 9: Verify tbclient Wiring

```bash
cd /home/ubuntu/repos/corebanking
for svc in tb-account-flags-go tb-multicurrency-ledger-go tb-overdraft-protection-go \
           tb-pending-sweeper-go tb-regulatory-ledger-go tb-subledger-go tb-gl-reconciliation-go; do
  count=$(grep -c 'tbClient\.' services/$svc/main.go 2>/dev/null || echo 0)
  echo "$svc: $count tbClient method calls"
done
```
**Expected**: 6/7 have >= 1 call. `tb-gl-reconciliation-go` may have 0 calls (known gap).

## Step 10: Verify DEFERRED Stubs
```bash
grep -rn "In production" services/gl-engine-go/main.go services/payments-hub-go/main.go services/temporal-worker-go/main.go
# Expected: 0 matches
grep -rn "DEFERRED" services/gl-engine-go/main.go services/payments-hub-go/main.go services/temporal-worker-go/main.go
# Expected: 6 matches (Kafka, Keycloak, Temporal stubs)
```

## Step 11: Verify Redis Integration
```bash
grep -n 'redis\.NewClient\|redisClient\.Set\|redisClient\.Get\|go-redis' \
  services/payments-hub-go/main.go services/payments-hub-go/go.mod
```
**Expected**: go.mod has `github.com/redis/go-redis/v9`, main.go has NewClient + Get/Set calls. At runtime without Redis, service logs "Redis connection failed... idempotency will use PostgreSQL fallback" and continues working.

## Step 12: Verify Audit Trail Schema (for tbclient)
```bash
cd /home/ubuntu/repos/corebanking/pkg/tbclient
# Tables must be tb_audit_* (NOT tb_accounts/tb_transfers which would be the old facade)
grep 'CREATE TABLE IF NOT EXISTS' client.go
# Expected: tb_audit_accounts, tb_audit_transfers

# ON CONFLICT for idempotency
grep -c 'ON CONFLICT.*DO NOTHING' client.go
# Expected: 2
```

## Testing Tips

- This is all shell-only testing — do NOT start a recording
- Always use `-race` flag when running Go tests on these packages — they involve concurrency
- The `pkg/outbox` auto-relay test uses `time.Sleep` for goroutine synchronization — if it's flaky, increase sleep from 200ms to 500ms
- `pkg/tb2pc` has a preexisting data race in `expireLoop()` — always check `git log` to confirm whether any failure is from your commit or preexisting
- `pkg/distlock` `NewLockManager()` starts a cleanup goroutine — tests don't need `defer Stop()` but it's harmless
- For the `gl-engine-rs` Rust changes (i64 kobo, validate_double_entry), use `cargo check` in `services/gl-engine-rs/` — takes 15-30s for dependency resolution
- **PostgreSQL auth**: Services default to connecting as `postgres` without password. You may need `ALTER USER postgres PASSWORD 'testpass';` and pass `?sslmode=disable` in DATABASE_URL
- **API routes**: Don't guess routes — `grep -n 'HandleFunc\|http.Handle\|router\.' services/SERVICE/main.go` to find exact endpoints
- **payments-hub-go requires Bearer auth**: Add `-H "Authorization: Bearer test-token-123"` — the middleware only checks for "Bearer " prefix
- **Rust services**: Use `PORT` env var (defaults vary). Build with `cargo build --release` for speed
- **Python services**: Use `PORT` env var. Ensure `psycopg2` is installed (`pip3 install psycopg2-binary`)
- **Kill processes cleanly**: Use unique ports per service (9046-9060 range). Check `lsof -i :PORT` before starting
- **TigerBeetle SDK Uint128 gotchas**: The CGo type `Uint128` cannot be sliced (`v[:]` fails), cannot be compared with `Uint128{}` for zero (use `tb.ToUint128(0)`), and `BytesToUint128()` takes `[16]byte` not `[]byte`. If you get type errors, check the SDK source at `github.com/tigerbeetle/tigerbeetle-go/uint128.go`.
- **Verifying "real SDK" vs "facade"**: The key proof is `go list -deps ./... | grep tigerbeetle` showing both `tigerbeetle-go` and `tigerbeetle-go/native`. The `/native` package contains the compiled C library — a pure-Go facade would never depend on it.

## Devin Secrets Needed

- PostgreSQL password for user `postgres` (set locally via `ALTER USER postgres PASSWORD 'testpass'`)
- No external secrets needed — all testing is local
