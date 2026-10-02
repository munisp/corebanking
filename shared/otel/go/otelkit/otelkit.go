package otelkit

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// Environment variable names honored by the kit (SPEC §2.1).
const (
	// EnvOTLPEndpoint is the OTLP gRPC endpoint env var.
	EnvOTLPEndpoint = "OTEL_EXPORTER_OTLP_ENDPOINT"
	// EnvServiceName is the primary service-name env var.
	EnvServiceName = "OTEL_SERVICE_NAME"
	// EnvServiceNameFallback is the secondary service-name env var.
	EnvServiceNameFallback = "SERVICE_NAME"
	// EnvSamplerArg holds the trace-id-ratio sampler argument.
	EnvSamplerArg = "OTEL_TRACES_SAMPLER_ARG"
	// EnvSDKDisabled disables the SDK when truthy.
	EnvSDKDisabled = "OTEL_SDK_DISABLED"
	// EnvDeployEnv sets the deployment.environment resource attribute.
	EnvDeployEnv = "DEPLOY_ENV"

	// DefaultOTLPEndpoint is the in-cluster collector default (SPEC §2.1).
	DefaultOTLPEndpoint = "http://otel-collector:4317"
	// ServiceNamespace is the fixed resource namespace (SPEC §2.2).
	ServiceNamespace = "corebanking"

	tracerName = "shared/otel/go/otelkit"
)

// SDKDisabled reports whether OTEL_SDK_DISABLED requests a no-op SDK.
func SDKDisabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(EnvSDKDisabled))) {
	case "true", "1", "yes":
		return true
	default:
		return false
	}
}

// resolveServiceName implements SPEC §2.1: OTEL_SERVICE_NAME → SERVICE_NAME → fallback.
func resolveServiceName(fallback string) string {
	if v := strings.TrimSpace(os.Getenv(EnvServiceName)); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv(EnvServiceNameFallback)); v != "" {
		return v
	}
	return fallback
}

// samplerArg parses OTEL_TRACES_SAMPLER_ARG; default and fallback are 1.0
// (money services always sample 100%, SPEC §2.1).
func samplerArg() float64 {
	v := strings.TrimSpace(os.Getenv(EnvSamplerArg))
	if v == "" {
		return 1.0
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil || f < 0 || f > 1 {
		return 1.0
	}
	return f
}

func deployEnv() string {
	if v := strings.TrimSpace(os.Getenv(EnvDeployEnv)); v != "" {
		return v
	}
	return "dev"
}

func otlpEndpoint() (endpoint string, insecure bool) {
	endpoint = strings.TrimSpace(os.Getenv(EnvOTLPEndpoint))
	if endpoint == "" {
		endpoint = DefaultOTLPEndpoint
	}
	insecure = !strings.HasPrefix(strings.ToLower(endpoint), "https://")
	return endpoint, insecure
}

// Init initializes OpenTelemetry tracing and metrics for the service and
// returns a shutdown function that flushes and stops both providers.
//
// Callers typically use:
//
//	shutdown, err := otelkit.Init(ctx, "my-service")
//	if err != nil { log.Fatalf(...) }
//	defer func() {
//		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
//		defer cancel()
//		_ = shutdown(ctx)
//	}()
//
// When OTEL_SDK_DISABLED is truthy, Init is a no-op and the returned shutdown
// is nil-safe (returns nil error).
func Init(ctx context.Context, serviceName string) (shutdown func(context.Context) error, err error) {
	if SDKDisabled() {
		return func(context.Context) error { return nil }, nil
	}

	name := resolveServiceName(serviceName)
	endpoint, insecure := otlpEndpoint()

	traceOpts := []otlptracegrpc.Option{otlptracegrpc.WithEndpointURL(endpoint)}
	metricOpts := []otlpmetricgrpc.Option{otlpmetricgrpc.WithEndpointURL(endpoint)}
	if insecure {
		traceOpts = append(traceOpts, otlptracegrpc.WithInsecure())
		metricOpts = append(metricOpts, otlpmetricgrpc.WithInsecure())
	}

	traceExp, err := otlptracegrpc.New(ctx, traceOpts...)
	if err != nil {
		return nil, fmt.Errorf("otelkit: OTLP trace exporter: %w", err)
	}
	metricExp, err := otlpmetricgrpc.New(ctx, metricOpts...)
	if err != nil {
		return nil, fmt.Errorf("otelkit: OTLP metric exporter: %w", err)
	}

	// SPEC §2.2 resource attributes.
	res, err := resource.New(ctx,
		resource.WithAttributes(
			attribute.String("service.name", name),
			attribute.String("service.namespace", ServiceNamespace),
			attribute.String("deployment.environment", deployEnv()),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("otelkit: resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(samplerArg()))),
		// tenantSpanProcessor must run before the batcher so tenant.id is
		// stamped at span start (SPEC §2.3).
		sdktrace.WithSpanProcessor(tenantSpanProcessor{}),
		sdktrace.WithBatcher(traceExp),
	)
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp)),
	)

	otel.SetTracerProvider(tp)
	otel.SetMeterProvider(mp)
	// SPEC §2.4: W3C tracecontext + baggage everywhere.
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))

	return func(ctx context.Context) error {
		return errors.Join(tp.Shutdown(ctx), mp.Shutdown(ctx))
	}, nil
}
