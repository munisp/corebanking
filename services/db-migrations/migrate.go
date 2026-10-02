// db-migrations — real schema migration runner (B5 remediation, P1-C).
//
// Replaces the 614-line in-memory stub (zero CREATE TABLE) with a Flyway-style
// runner modelled on the repo's two real migration implementations:
//   - services/transaction-ledger/database/migrate.py (V<nnn>__*.sql discovery,
//     schema_migrations ledger, idempotent re-run, fail-fatal on error)
//   - services/feature-entitlement-go + gl-engine-go migration dirs
//     (<nnn>_<name>.up.sql naming)
//   - infrastructure/new/scripts/migrate.sh + drizzle/migrations/000 (checksum
//   - execution_time_ms ledger columns)
//
// Properties:
//   - ordered migration dir — embedded via go:embed; MIGRATIONS_DIR overrides
//     with a volume-mounted directory (same V<version>__<name>.sql filenames)
//   - schema_migrations ledger (see ensureLedger for the shared-table
//     compatibility design with transaction-ledger's runner)
//   - up-only, single-flight via pg_advisory_lock
//   - per-migration transaction (a file may opt out with a first-line
//     "-- migrate:no-transaction" marker, mirroring the drizzle 005
//     CONCURRENTLY convention)
//   - fail-closed on dirty state: a failed migration records a dirty ledger
//     row; every subsequent run refuses to apply anything until the row is
//     manually resolved. /readyz reports 503 while dirty or pending.
package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// advisoryLockKey is a fixed 64-bit key for pg_advisory_lock so only one
// db-migrations replica (or operator psql session following the README)
// migrates at a time. Value: ASCII-ish "54BANKMG" folded into an int64.
const advisoryLockKey int64 = 54888012612

// platformVersionFloor reserves the schema_migrations version space
// >= 20260000 for this runner. transaction-ledger/database/migrate.py owns
// small integer versions (1, 2, 3 today) in the SAME shared database
// (docker-compose.consolidated.yml:21 — single link_core_banking DB), so the
// two runners must never collide on the ledger primary key.
const platformVersionFloor = 20260000

//go:embed migrations/*.sql
var embeddedMigrations embed.FS

var migrationFileRe = regexp.MustCompile(`^V(\d+)__.+\.sql$`)

type migration struct {
	Version  int64
	Name     string // filename
	SQL      string
	Checksum string // sha256 hex
	// NoTx files carry the "-- migrate:no-transaction" marker (used by
	// CONCURRENTLY index builds, per the drizzle 005 convention).
	NoTx bool
}

type ledgerRow struct {
	Version         int64
	Script          string
	AppliedAt       time.Time
	Checksum        sql.NullString
	ExecutionTimeMs sql.NullInt64
	Runner          sql.NullString
	Dirty           bool
}

// runnerState is the process-wide migration status surfaced on the health
// endpoints. Written once at boot (and after /v1/db-migrations/run), read by
// probes; guarded by stateMu.
type runnerState struct {
	Applied   int         `json:"applied"`
	Pending   []string    `json:"pending"`
	Dirty     []int64     `json:"dirty"`
	LastError string      `json:"lastError,omitempty"`
	LastRun   time.Time   `json:"lastRun"`
	Entries   []ledgerRow `json:"-"`
}

// discoverMigrations loads V<version>__*.sql files from MIGRATIONS_DIR when
// set (volume mount), else from the embedded migrations/ directory.
func discoverMigrations() ([]migration, error) {
	dir := os.Getenv("MIGRATIONS_DIR")
	var fsys fs.FS
	if dir != "" {
		fsys = os.DirFS(dir)
	} else {
		sub, err := fs.Sub(embeddedMigrations, "migrations")
		if err != nil {
			return nil, err
		}
		fsys = sub
	}
	var out []migration
	err := fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != "." {
				return fs.SkipDir
			}
			return nil
		}
		m := migrationFileRe.MatchString(d.Name())
		if !m {
			// README.md and friends are documentation, not migrations.
			return nil
		}
		parts := migrationFileRe.FindStringSubmatch(d.Name())
		var version int64
		if _, err := fmt.Sscan(parts[1], &version); err != nil {
			return fmt.Errorf("parse version from %s: %w", d.Name(), err)
		}
		if version < platformVersionFloor {
			return fmt.Errorf("migration %s: version %d below platform floor %d "+
				"(versions >= %d are reserved for this runner — see migrate.go)",
				d.Name(), version, platformVersionFloor, platformVersionFloor)
		}
		body, err := fs.ReadFile(fsys, path)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(body)
		sqlText := string(body)
		out = append(out, migration{
			Version:  version,
			Name:     d.Name(),
			SQL:      sqlText,
			Checksum: hex.EncodeToString(sum[:]),
			NoTx:     strings.Contains(firstLine(sqlText), "migrate:no-transaction"),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	for i := 1; i < len(out); i++ {
		if out[i].Version == out[i-1].Version {
			return nil, fmt.Errorf("duplicate migration version %d (%s and %s)",
				out[i].Version, out[i-1].Name, out[i].Name)
		}
	}
	return out, nil
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

// connectDB resolves the fleet DATABASE_URL conventions
// (docker-compose.consolidated.yml:19-32): URL-style first (DATABASE_URL,
// then DATABASE_URI), then param-style DB_HOST/DB_PORT/DB_NAME/DB_USER/
// DB_PASSWORD (+ optional DB_SSLMODE, default require — the managed-PG
// fleet default).
func connectDB(ctx context.Context) (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URI")
	}
	if dsn == "" {
		host := os.Getenv("DB_HOST")
		name := os.Getenv("DB_NAME")
		user := os.Getenv("DB_USER")
		if host == "" || name == "" || user == "" {
			return nil, errors.New("no database configuration: set DATABASE_URL " +
				"(or DATABASE_URI, or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD)")
		}
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "5432"
		}
		sslmode := os.Getenv("DB_SSLMODE")
		if sslmode == "" {
			sslmode = "require"
		}
		dsn = fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=%s",
			host, port, name, user, os.Getenv("DB_PASSWORD"), sslmode)
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(2) // a runner needs one migration conn + one status conn
	db.SetMaxIdleConns(1)
	pingCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("database ping: %w", err)
	}
	return db, nil
}

// ensureLedger creates/extends the schema_migrations ledger.
//
// SHARED-TABLE COMPATIBILITY: transaction-ledger's runner
// (services/transaction-ledger/database/migrate.py:52-58) creates
// schema_migrations(version INTEGER PK, script TEXT NOT NULL, applied_at) in
// the same shared database and decides "already applied" by testing its small
// integer versions against every row. This runner therefore:
//   - keeps the table name and the (version, script, applied_at) core columns
//     with identical semantics (transaction-ledger re-runs stay no-ops),
//   - uses version numbers >= 20260000 (platformVersionFloor),
//   - adds its bookkeeping columns additively (ADD COLUMN IF NOT EXISTS), so
//     transaction-ledger's INSERT (version, script) keeps working.
func ensureLedger(ctx context.Context, db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			script TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT`,
		`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER`,
		`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS runner TEXT NOT NULL DEFAULT 'unknown'`,
		`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS dirty BOOLEAN NOT NULL DEFAULT FALSE`,
	}
	for _, s := range stmts {
		if _, err := db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("ensure ledger: %w", err)
		}
	}
	return nil
}

func loadLedger(ctx context.Context, db *sql.DB) ([]ledgerRow, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT version, script, applied_at, checksum, execution_time_ms, runner, dirty
		 FROM schema_migrations ORDER BY version`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ledgerRow
	for rows.Next() {
		var r ledgerRow
		if err := rows.Scan(&r.Version, &r.Script, &r.AppliedAt,
			&r.Checksum, &r.ExecutionTimeMs, &r.Runner, &r.Dirty); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// markDirty records a failed migration OUTSIDE the rolled-back migration tx.
// Fail-closed: any dirty row blocks all future runs until an operator
// resolves it (README: fix the cause, then DELETE the dirty row).
func markDirty(ctx context.Context, db *sql.DB, m migration, cause error) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO schema_migrations (version, script, checksum, runner, dirty)
		 VALUES ($1, $2, $3, 'db-migrations', TRUE)
		 ON CONFLICT (version) DO UPDATE SET dirty = TRUE`,
		m.Version, m.Name, m.Checksum)
	if err != nil {
		return fmt.Errorf("mark dirty for %s: %w (original failure: %v)", m.Name, err, cause)
	}
	return nil
}

// applyMigrations runs every pending migration in version order under the
// cluster-wide advisory lock. It never mutates state on failure beyond the
// dirty ledger row (fail-closed).
func applyMigrations(ctx context.Context, db *sql.DB) (*runnerState, error) {
	state := &runnerState{LastRun: time.Now().UTC()}

	migrations, err := discoverMigrations()
	if err != nil {
		return state, err
	}
	if err := ensureLedger(ctx, db); err != nil {
		return state, err
	}

	// Single-flight: session-level advisory lock held for the whole run.
	lockConn, err := db.Conn(ctx)
	if err != nil {
		return state, err
	}
	defer lockConn.Close()
	if _, err := lockConn.ExecContext(ctx, `SELECT pg_advisory_lock($1)`, advisoryLockKey); err != nil {
		return state, fmt.Errorf("acquire advisory lock: %w", err)
	}
	defer func() {
		if _, err := lockConn.ExecContext(context.Background(),
			`SELECT pg_advisory_unlock($1)`, advisoryLockKey); err != nil {
			log.Printf("[db-migrations] advisory unlock failed: %v", err)
		}
	}()

	ledger, err := loadLedger(ctx, db)
	if err != nil {
		return state, err
	}
	state.Entries = ledger
	applied := map[int64]ledgerRow{}
	for _, row := range ledger {
		if row.Dirty {
			state.Dirty = append(state.Dirty, row.Version)
		}
		applied[row.Version] = row
	}

	// Fail-closed on dirty state: refuse to apply anything.
	if len(state.Dirty) > 0 {
		state.LastError = fmt.Sprintf(
			"dirty schema_migrations versions %v — resolve manually (see README) before re-running", state.Dirty)
		for _, m := range migrations {
			if _, ok := applied[m.Version]; !ok {
				state.Pending = append(state.Pending, m.Name)
			}
		}
		state.Applied = countAppliedPlatform(ledger)
		return state, errors.New(state.LastError)
	}

	for _, m := range migrations {
		row, ok := applied[m.Version]
		if ok {
			// Tamper detection: a changed file for an applied version is
			// schema drift — fail closed, do not silently continue.
			if row.Checksum.Valid && row.Runner.String == "db-migrations" &&
				row.Checksum.String != m.Checksum {
				state.LastError = fmt.Sprintf(
					"checksum mismatch for applied migration %s (ledger %s, file %s)",
					m.Name, row.Checksum.String, m.Checksum)
				if fresh, lerr := loadLedger(ctx, db); lerr == nil {
					state.Entries = fresh
					state.Applied = countAppliedPlatform(fresh)
				}
				return state, errors.New(state.LastError)
			}
			continue
		}
		log.Printf("[db-migrations] applying %s", m.Name)
		start := time.Now()
		execErr := execMigration(ctx, db, m)
		elapsed := time.Since(start).Milliseconds()
		if execErr != nil {
			state.LastError = fmt.Sprintf("%s failed: %v", m.Name, execErr)
			if derr := markDirty(ctx, db, m, execErr); derr != nil {
				log.Printf("[db-migrations] %v", derr)
			}
			state.Dirty = append(state.Dirty, m.Version)
			// Refresh from the ledger: earlier migrations in this same run may
			// have applied successfully before the failure.
			if fresh, lerr := loadLedger(ctx, db); lerr == nil {
				state.Entries = fresh
				state.Applied = countAppliedPlatform(fresh)
			}
			return state, fmt.Errorf("%s: %w", m.Name, execErr)
		}
		log.Printf("[db-migrations] applied %s in %dms", m.Name, elapsed)
	}

	// Refresh state for probes.
	ledger, err = loadLedger(ctx, db)
	if err == nil {
		state.Entries = ledger
		state.Applied = countAppliedPlatform(ledger)
	}
	state.Pending = nil
	return state, nil
}

// countAppliedPlatform counts non-dirty rows owned by this runner.
func countAppliedPlatform(ledger []ledgerRow) int {
	n := 0
	for _, r := range ledger {
		if r.Runner.Valid && r.Runner.String == "db-migrations" && !r.Dirty {
			n++
		}
	}
	return n
}

// execMigration applies one file and records its ledger row. Per-migration
// transaction: the file's DDL and the ledger insert commit or roll back
// together, unless the file carries the -- migrate:no-transaction marker
// (CONCURRENTLY builds — then the ledger row is recorded right after in its
// own implicit tx; a crash between the two leaves a dirty marker on the next
// run's re-attempt via markDirty, keeping the state machine fail-closed).
func execMigration(ctx context.Context, db *sql.DB, m migration) error {
	const record = `INSERT INTO schema_migrations
			(version, script, checksum, execution_time_ms, runner, dirty)
		VALUES ($1, $2, $3, $4, 'db-migrations', FALSE)`
	start := time.Now()
	if m.NoTx {
		if _, err := db.ExecContext(ctx, m.SQL); err != nil {
			return err
		}
		_, err := db.ExecContext(ctx, record, m.Version, m.Name, m.Checksum,
			time.Since(start).Milliseconds())
		return err
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err := tx.ExecContext(ctx, record, m.Version, m.Name, m.Checksum,
		time.Since(start).Milliseconds()); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
