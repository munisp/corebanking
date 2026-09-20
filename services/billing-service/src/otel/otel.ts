/**
 * @corebanking/otelkit — shared OpenTelemetry kit for TypeScript services.
 *
 * SPEC.md §2.5 contract (SACRED):
 *   export function initOtel(serviceName: string): () => Promise<void>
 *
 * Behavior:
 *  - NodeSDK with OTLP gRPC trace + metric exporters.
 *  - Auto-instrumentations: http, express, typeorm, ioredis (only these four).
 *  - Resource attributes (SPEC §2.2): service.name, service.namespace="corebanking",
 *    deployment.environment (env DEPLOY_ENV, default "dev").
 *  - Env (SPEC §2.1):
 *      OTEL_EXPORTER_OTLP_ENDPOINT  default "http://otel-collector:4317" (gRPC)
 *      OTEL_SERVICE_NAME            overrides serviceName arg; falls back to SERVICE_NAME
 *      OTEL_TRACES_SAMPLER_ARG      default "1.0" (money services always 1.0)
 *      OTEL_SDK_DISABLED            "true" => full no-op, initOtel returns async no-op shutdown
 *  - No secrets in telemetry config; endpoint is env-driven with documented default.
 *
 * IMPORTANT (initialization order): instrumentations patch modules at require time,
 * so initOtel() MUST run before express/typeorm/ioredis are first required. Import the
 * per-service `otel/init` module as the FIRST import of the service entrypoint:
 *
 *   import "./otel/init"; // MUST be the first import — initializes OTel
 *   import "reflect-metadata";
 *   ...
 */

import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from "@opentelemetry/api";
import type { Counter } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { TypeormInstrumentation } from "@opentelemetry/instrumentation-typeorm";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";

const DEFAULT_OTLP_ENDPOINT = "http://otel-collector:4317";
const SERVICE_NAMESPACE = "corebanking";
const METER_NAME = "corebanking";

function sdkDisabled(): boolean {
  return (process.env.OTEL_SDK_DISABLED ?? "").trim().toLowerCase() === "true";
}

function samplerArg(): number {
  const raw = process.env.OTEL_TRACES_SAMPLER_ARG ?? "1.0";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1.0;
  return Math.min(1, Math.max(0, parsed));
}

/**
 * Initialize OpenTelemetry for this process.
 *
 * @param serviceName canonical service name; overridden by OTEL_SERVICE_NAME,
 *                    then SERVICE_NAME (SPEC §2.1).
 * @returns shutdown function — flushes exporters and stops the SDK. Safe to call
 *          multiple times; a no-op when OTEL_SDK_DISABLED=true.
 */
export function initOtel(serviceName: string): () => Promise<void> {
  if (sdkDisabled()) {
    // Honored unconditionally (SPEC §2.1): no exporters, no instrumentations.
    return async () => {};
  }

  if ((process.env.OTEL_LOG_LEVEL ?? "").toLowerCase() === "debug") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resolvedServiceName =
    process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? serviceName;
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_OTLP_ENDPOINT;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": resolvedServiceName,
      "service.namespace": SERVICE_NAMESPACE,
      "deployment.environment": process.env.DEPLOY_ENV ?? "dev",
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(samplerArg()),
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new TypeormInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();

  let stopped = false;
  return async () => {
    if (stopped) return;
    stopped = true;
    await sdk.shutdown();
  };
}

/**
 * Increment a named counter metric (SPEC addendum: custom money-path counters such
 * as sanctions_screen_errors_total / audit_ship_failures_total feed Grafana alert
 * rules — names are exact, do not rename).
 *
 * No-op when OTEL_SDK_DISABLED=true. Counters are created lazily and cached.
 * Attribute values must be strings; keep cardinality bounded (service, tenant_id).
 */
const counterCache = new Map<string, Counter>();

export function incCounter(
  name: string,
  attrs: Record<string, string> = {},
): void {
  if (sdkDisabled()) return;
  let counter = counterCache.get(name);
  if (!counter) {
    counter = metrics.getMeter(METER_NAME).createCounter(name);
    counterCache.set(name, counter);
  }
  counter.add(1, attrs);
}
