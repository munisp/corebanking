package otelkit

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// TigerBeetleSpan runs fn inside a client span named "tigerbeetle.<op>"
// (SPEC §2.5). Errors are recorded and mapped to span status; tenant.id is
// inherited from ctx via the tenant span processor.
//
// When OTEL_SDK_DISABLED is truthy fn is invoked directly.
func TigerBeetleSpan(ctx context.Context, op string, fn func(context.Context) error) error {
	if SDKDisabled() {
		return fn(ctx)
	}
	ctx, span := otel.Tracer(tracerName+"/tigerbeetle").Start(ctx, "tigerbeetle."+op,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "tigerbeetle"),
			attribute.String("db.operation.name", op),
		),
	)
	defer span.End()
	if err := fn(ctx); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	span.SetStatus(codes.Ok, "")
	return nil
}
