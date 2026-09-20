package otelkit

import (
	"context"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// counters caches synchronous instruments by name so repeated IncCounter
// calls never re-create them.
var counters sync.Map // map[string]metric.Int64Counter

// IncCounter atomically increments a named Int64 counter by one (SPEC §2.5
// addendum — Grafana alert rules depend on these exact metric names, e.g.
// eod_run_failures_total, audit_ship_failures_total,
// loan_disbursement_events_total).
//
// The counter is fetched from the global meter provider; when the SDK is
// disabled (or Init has not run) the call is a cheap no-op.
func IncCounter(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	if SDKDisabled() {
		return
	}
	counter, ok := counters.Load(name)
	if !ok {
		c, err := otel.GetMeterProvider().Meter(tracerName).Int64Counter(name)
		if err != nil {
			return
		}
		counter, _ = counters.LoadOrStore(name, c)
	}
	counter.(metric.Int64Counter).Add(ctx, 1, metric.WithAttributes(attrs...))
}
