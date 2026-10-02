# db-migrations — platform schema migration runner (B5 P1-C)

Single owned migration path for the 54Bank fleet. Replaces the wave-11 stub
(614-line in-memory CRUD facade, zero `CREATE TABLE`) with a real,
fail-closed runner.

## What it owns today

| Migration | Table | Why |
|---|---|---|
| `migrations/V20260001__outbox_table.sql` | `outbox` | 275 services created it at boot; 134 more reference it without creating it |
| `migrations/V20260002__service_records_table.sql` | `service_records` | 127 boot creators, 4 DDL variants |
| `migrations/V20260003__service_configs_table.sql` | `service_configs` | 270 boot creators, 5 DDL variants, two mutually-breaking families |

Canonical DDL was harvested from every boot-time `CREATE TABLE` in the fleet
(evidence: `work/w12/schema-harvest.json`, per-variant service lists) and
verified against the actual `INSERT`/`SELECT`/`UPDATE` statements in the
code. Each file's header documents per-column provenance. Superset rule:
columns any family writes are present; columns not written by every family
are nullable or defaulted, so **no existing write breaks**.

## Runner semantics (migrate.go)

- **Discovery:** `V<version>__<name>.sql`, sorted by version. Embedded via
  `go:embed`; set `MIGRATIONS_DIR` to override with a volume mount.
- **Version space:** versions `>= 20260000` are reserved for this runner.
  `transaction-ledger/database/migrate.py` owns small integer versions in the
  same shared `schema_migrations` table (single `link_core_banking` DB per
  `docker-compose.consolidated.yml`); the ledger is extended additively
  (`checksum`, `execution_time_ms`, `runner`, `dirty`) so that runner's
  create/insert/select semantics keep working unchanged.
- **Single flight:** `pg_advisory_lock` held for the whole run.
- **Per-migration transaction:** file + ledger row commit/rollback together.
  A file whose first line contains `-- migrate:no-transaction` runs outside
  the tx (for `CREATE INDEX CONCURRENTLY`, mirroring the drizzle 005
  convention).
- **Idempotent re-run:** applied versions are skipped; a checksum change on
  an applied file is tamper/drift and fails closed.
- **Fail-closed dirty state:** a failed migration writes a dirty ledger row.
  Every later run refuses to apply anything (`/readyz` 503) until an operator
  fixes the cause and resolves the row:
  `DELETE FROM schema_migrations WHERE version = <v> AND dirty;`

## Registering a service-specific migration

The 470-service boot-DDL-removal codemod (later wave) and any hand-written
service migration register here:

1. Add `migrations/V<version>__<name>.sql` with a version `>= 20260000`,
   monotonically increasing (next free: `20260004`).
2. Header comment must cite the evidence (service file:line) for every
   column/index — see the three template files for the format.
3. Statements must be idempotent (`IF NOT EXISTS` / guarded `DO` blocks) so a
   service whose boot DDL still races the runner cannot break the run.
4. Only use `-- migrate:no-transaction` when a statement requires it
   (CONCURRENTLY); say so in the header.
5. `grep -c '^V' migrations/*.sql` must stay unique per version — CI check:
   duplicate versions make the runner fail at discovery.

## Configuration (fleet conventions)

`DATABASE_URL` → `DATABASE_URI` → `DB_HOST/DB_PORT/DB_NAME/DB_USER/
DB_PASSWORD` (+ `DB_SSLMODE`, default `require`). `PORT` (default `9345`).
`MIGRATIONS_EXIT_AFTER_RUN=true` for k8s Job/initContainer mode (exit 0 on
success, 1 on failure; default mode serves status with `/readyz` 503 while
degraded).

## Endpoints

`/healthz` (status + migration summary), `/readyz` (503 while
dirty/pending/unreachable), `/livez`, `/metrics` (adds
`db_migrations_applied/pending/dirty` gauges), and — behind the Keycloak JWKS
middleware — `/v1/db-migrations/status` (full ledger),
`/list` `/audit` `/stats` (ledger views), `POST /v1/db-migrations/run`
(re-apply pending; refuses while dirty). The stub's fabricated
`create/update/process` in-memory routes now return 501 honestly.

## Boot-DDL compatibility (for the removal codemod)

The 470 services' `CREATE TABLE IF NOT EXISTS` statements are
idempotent-compatible with this runner: whichever runs first, the table ends
up canonical — the runner's guarded `DO` blocks converge drifted pre-existing
tables (`id` uuid→text on `outbox`, `data` text→jsonb on `service_records`,
NOT NULL relaxation on `service_configs`), and boot DDL afterwards is a
no-op. The removal codemod can therefore delete boot DDL in any order, per
language wave, after this runner is deployed fleet-wide. Verification script:
`verify/V2026_verify.sql` (column-set equality between canonical DDL and
every harvested boot variant).
