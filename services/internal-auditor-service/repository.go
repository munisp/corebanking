package main

// repository.go — Postgres-backed generic repository for internal-auditor-service.
//
// Data integrity doctrine:
//   - Postgres is the ONLY system of record. DATABASE_URL is required at
//     boot; the process exits (log.Fatal) when the database is unreachable
//     or schema init fails — there is no in-memory fallback.
//   - Every entity lives in a real table with a JSONB document column.
//   - Seeds are idempotent (ON CONFLICT DO NOTHING) so restarts never
//     duplicate or overwrite operator data.
//   - Mutating state transitions run inside a transaction with
//     SELECT ... FOR UPDATE row locks.

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// ErrNotFound is returned when a row does not exist for (tenant, id).
var ErrNotFound = errors.New("not found")

// serviceDB is the process-wide Postgres handle. It is established at package
// initialisation; boot fails closed when the database is unavailable.
var serviceDB = mustServiceDB()

func mustServiceDB() *sql.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("[internal-auditor-service] DATABASE_URL is required; refusing to boot without durable storage")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("[internal-auditor-service] postgres open failed: %v", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		log.Fatalf("[internal-auditor-service] postgres unreachable at boot: %v", err)
	}
	return db
}

// tableDDL is the standard entity-table schema (JSONB document store with
// typed primary key and tenant scoping).
func tableDDL(table string) string {
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s (
		id TEXT PRIMARY KEY,
		tenant_id TEXT NOT NULL,
		doc JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`, table)
}

// repo is a generic Postgres repository for one entity type.
type repo[T any] struct {
	db    *sql.DB
	table string
}

// newRepo creates the table (and any extra DDL such as indexes) and returns
// the repository. Boot fails closed on any schema error.
func newRepo[T any](db *sql.DB, table string, extraDDL ...string) *repo[T] {
	if _, err := db.Exec(tableDDL(table)); err != nil {
		log.Fatalf("[internal-auditor-service] schema init for %s failed: %v", table, err)
	}
	for _, stmt := range extraDDL {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("[internal-auditor-service] schema init for %s failed: %v", table, err)
		}
	}
	return &repo[T]{db: db, table: table}
}

// put upserts the entity (create or full replace).
func (r *repo[T]) put(tenantID, id string, v *T) error {
	doc, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal %s/%s: %w", r.table, id, err)
	}
	_, err = r.db.Exec(fmt.Sprintf(`INSERT INTO %s (id, tenant_id, doc, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (id) DO UPDATE SET doc = $3, updated_at = NOW()`, r.table),
		id, tenantID, string(doc))
	if err != nil {
		return fmt.Errorf("put %s/%s: %w", r.table, id, err)
	}
	return nil
}

// seed inserts the entity only when absent (idempotent boot seed). A seed
// failure is a boot failure: the process exits rather than running with
// incomplete reference data.
func (r *repo[T]) seed(tenantID, id string, v *T) {
	doc, err := json.Marshal(v)
	if err != nil {
		log.Fatalf("[internal-auditor-service] seed marshal %s/%s failed: %v", r.table, id, err)
	}
	if _, err := r.db.Exec(fmt.Sprintf(`INSERT INTO %s (id, tenant_id, doc)
		VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, r.table),
		id, tenantID, string(doc)); err != nil {
		log.Fatalf("[internal-auditor-service] seed %s/%s failed: %v", r.table, id, err)
	}
}

// get loads one entity scoped to the tenant. Returns ErrNotFound when absent.
func (r *repo[T]) get(tenantID, id string) (*T, error) {
	var doc []byte
	err := r.db.QueryRow(fmt.Sprintf(`SELECT doc FROM %s WHERE id = $1 AND tenant_id = $2`, r.table),
		id, tenantID).Scan(&doc)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get %s/%s: %w", r.table, id, err)
	}
	var v T
	if err := json.Unmarshal(doc, &v); err != nil {
		return nil, fmt.Errorf("decode %s/%s: %w", r.table, id, err)
	}
	return &v, nil
}

// list loads all entities for a tenant in stable insertion order.
func (r *repo[T]) list(tenantID string) ([]*T, error) {
	rows, err := r.db.Query(fmt.Sprintf(`SELECT doc FROM %s WHERE tenant_id = $1 ORDER BY created_at, id`, r.table),
		tenantID)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", r.table, err)
	}
	defer rows.Close()
	out := []*T{}
	for rows.Next() {
		var doc []byte
		if err := rows.Scan(&doc); err != nil {
			return nil, fmt.Errorf("list %s scan: %w", r.table, err)
		}
		var v T
		if err := json.Unmarshal(doc, &v); err != nil {
			return nil, fmt.Errorf("list %s decode: %w", r.table, err)
		}
		out = append(out, &v)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list %s: %w", r.table, err)
	}
	return out, nil
}

// del removes an entity scoped to the tenant.
func (r *repo[T]) del(tenantID, id string) error {
	res, err := r.db.Exec(fmt.Sprintf(`DELETE FROM %s WHERE id = $1 AND tenant_id = $2`, r.table),
		id, tenantID)
	if err != nil {
		return fmt.Errorf("delete %s/%s: %w", r.table, id, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// update runs fn against the row inside a transaction with the row locked
// (SELECT ... FOR UPDATE); fn mutates the entity in place and the result is
// persisted atomically. Any error from fn rolls the transaction back.
func (r *repo[T]) update(tenantID, id string, fn func(*T) error) (*T, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("update %s/%s begin: %w", r.table, id, err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	var doc []byte
	err = tx.QueryRow(fmt.Sprintf(`SELECT doc FROM %s WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, r.table),
		id, tenantID).Scan(&doc)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("update %s/%s lock: %w", r.table, id, err)
	}
	var v T
	if err := json.Unmarshal(doc, &v); err != nil {
		return nil, fmt.Errorf("update %s/%s decode: %w", r.table, id, err)
	}
	if err := fn(&v); err != nil {
		return nil, err
	}
	doc, err = json.Marshal(&v)
	if err != nil {
		return nil, fmt.Errorf("update %s/%s marshal: %w", r.table, id, err)
	}
	if _, err := tx.Exec(fmt.Sprintf(`UPDATE %s SET doc = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, r.table),
		id, tenantID, string(doc)); err != nil {
		return nil, fmt.Errorf("update %s/%s write: %w", r.table, id, err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("update %s/%s commit: %w", r.table, id, err)
	}
	return &v, nil
}
