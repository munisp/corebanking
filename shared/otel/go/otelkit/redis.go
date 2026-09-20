package otelkit

import (
	"context"
	"net"
	"strings"

	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// RedisHook returns a go-redis/v9 tracing hook suitable for
// client.AddHook(...) / cluster.AddHook(...) (SPEC §2.5). Spans carry
// db.system=redis and the command name; db.statement intentionally contains
// only the command name (no argument values) to avoid leaking PII. tenant.id
// is inherited from the calling context via the tenant span processor.
//
// The hook is implemented in-kit (the go-redis extra/redisotel module only
// exports client-level InstrumentTracing, not a standalone redis.Hook, in
// the versions compatible with go 1.22).
//
// When OTEL_SDK_DISABLED is truthy a transparent no-op hook is returned.
func RedisHook() redis.Hook {
	if SDKDisabled() {
		return noopRedisHook{}
	}
	return redisTracingHook{tracer: otel.Tracer(tracerName + "/redis")}
}

// redisTracingHook implements redis.Hook with client spans per command.
type redisTracingHook struct {
	tracer trace.Tracer
}

func redisAttrs() []attribute.KeyValue {
	return []attribute.KeyValue{attribute.String("db.system", "redis")}
}

func (h redisTracingHook) DialHook(next redis.DialHook) redis.DialHook {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		attrs := append(redisAttrs(), attribute.String("server.address", addr))
		ctx, span := h.tracer.Start(ctx, "redis.dial",
			trace.WithSpanKind(trace.SpanKindClient), trace.WithAttributes(attrs...))
		defer span.End()
		conn, err := next(ctx, network, addr)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		return conn, err
	}
}

func (h redisTracingHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		name := strings.ToLower(cmd.Name())
		attrs := append(redisAttrs(),
			attribute.String("db.operation.name", strings.ToUpper(cmd.Name())),
			attribute.String("db.statement", name), // command name only — no args
		)
		ctx, span := h.tracer.Start(ctx, "redis."+name,
			trace.WithSpanKind(trace.SpanKindClient), trace.WithAttributes(attrs...))
		defer span.End()
		err := next(ctx, cmd)
		if err != nil && err != redis.Nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		return err
	}
}

func (h redisTracingHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		attrs := append(redisAttrs(), attribute.Int("db.redis.pipeline.size", len(cmds)))
		ctx, span := h.tracer.Start(ctx, "redis.pipeline",
			trace.WithSpanKind(trace.SpanKindClient), trace.WithAttributes(attrs...))
		defer span.End()
		err := next(ctx, cmds)
		if err != nil && err != redis.Nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		return err
	}
}

// noopRedisHook is a pass-through redis.Hook used when the SDK is disabled.
type noopRedisHook struct{}

func (noopRedisHook) DialHook(next redis.DialHook) redis.DialHook { return next }

func (noopRedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook { return next }

func (noopRedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
