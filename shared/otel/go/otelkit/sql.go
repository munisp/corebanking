package otelkit

import (
	"database/sql"
	"fmt"
	"strings"
	"sync"

	"github.com/XSAM/otelsql"
	"go.opentelemetry.io/otel/attribute"
)

// dbStatsRegs keeps the DBStats metric registrations alive for the lifetime
// of each wrapped *sql.DB.
var dbStatsRegs sync.Map // map[*sql.DB]metric.Registration

// WrapSQLDB instruments an existing *sql.DB with OpenTelemetry (SPEC §2.5).
//
// database/sql does not expose the connector/DSN of an open *sql.DB, so an
// existing handle cannot be re-wrapped for per-query spans; WrapSQLDB
// therefore registers OTel connection-pool metrics (sql.DBStats via
// otelsql.RegisterDBStatsMetrics) and returns the handle unchanged. For
// per-query tracing use OpenSQLDB at the open site — service patches use it
// wherever the DSN is in scope.
//
// When OTEL_SDK_DISABLED is truthy (or db is nil) the handle is returned
// unchanged.
func WrapSQLDB(db *sql.DB) *sql.DB {
	if db == nil || SDKDisabled() {
		return db
	}
	if _, loaded := dbStatsRegs.LoadOrStore(db, true); loaded {
		return db
	}
	if err := otelsql.RegisterDBStatsMetrics(db,
		otelsql.WithAttributes(attribute.String("db.system", driverSystemOf(db))),
	); err != nil {
		dbStatsRegs.Delete(db)
	}
	return db
}

// OpenSQLDB opens a database handle with full otelsql query/exec tracing
// (drop-in replacement for sql.Open). When OTEL_SDK_DISABLED is truthy it
// degrades to a plain sql.Open.
func OpenSQLDB(driverName, dataSourceName string) (*sql.DB, error) {
	if SDKDisabled() {
		return sql.Open(driverName, dataSourceName)
	}
	return otelsql.Open(driverName, dataSourceName,
		otelsql.WithAttributes(attribute.String("db.system", driverSystemOfName(driverName))),
	)
}

// driverSystemOf maps the underlying driver implementation to a db.system
// value so spans/metrics carry a meaningful database identifier.
func driverSystemOf(db *sql.DB) string {
	return driverSystemOfName(fmt.Sprintf("%T", db.Driver()))
}

func driverSystemOfName(driverName string) string {
	switch {
	case strings.Contains(driverName, "pq"), strings.Contains(driverName, "pgx"),
		strings.Contains(driverName, "postgres"):
		return "postgresql"
	case strings.Contains(driverName, "mysql"):
		return "mysql"
	case strings.Contains(driverName, "sqlite"):
		return "sqlite"
	case strings.Contains(driverName, "sqlserver"):
		return "mssql"
	default:
		return "sql"
	}
}
