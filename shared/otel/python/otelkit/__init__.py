"""otelkit — corebanking shared OpenTelemetry kit (SPEC w9 §2.5).

Sacred contract:
  init_telemetry(service_name: str, app: FastAPI|Flask|None = None) -> None

Environment (SPEC §2.1/§2.2):
  OTEL_EXPORTER_OTLP_ENDPOINT  default http://otel-collector:4317 (gRPC)
  OTEL_SERVICE_NAME            overrides service_name; falls back to SERVICE_NAME
  OTEL_TRACES_SAMPLER_ARG      default 1.0 (parentbased_traceidratio)
  OTEL_SDK_DISABLED            "true"/"1"/"yes" -> full no-op
  DEPLOY_ENV                   resource deployment.environment, default "dev"

Design constraints:
  - init_telemetry NEVER raises: telemetry must not take down a money path.
  - Idempotent: repeated calls are no-ops.
  - atexit flush of tracer + meter providers.
"""

from __future__ import annotations

import atexit
import logging
import os
from contextlib import contextmanager
from typing import Any, Optional

logger = logging.getLogger("otelkit")

DEFAULT_OTLP_ENDPOINT = "http://otel-collector:4317"
SERVICE_NAMESPACE = "corebanking"

_initialized = False
_enabled = False
_tracer_provider = None
_meter_provider = None

__all__ = [
    "init_telemetry",
    "is_enabled",
    "get_tracer",
    "tb_span",
    "inc_counter",
    "TenantMiddleware",
    "install_flask_tenant_hook",
    "instrument_sqlalchemy",
    "instrument_psycopg2",
    "instrument_redis",
    "instrument_kafka",
    "instrument_requests",
    "temporal_interceptor",
]


def sdk_disabled() -> bool:
    return os.environ.get("OTEL_SDK_DISABLED", "").strip().lower() in (
        "true",
        "1",
        "yes",
    )


def is_enabled() -> bool:
    return _enabled


def _resolve_service_name(service_name: Optional[str]) -> str:
    return (
        os.environ.get("OTEL_SERVICE_NAME")
        or service_name
        or os.environ.get("SERVICE_NAME")
        or "unknown-python-service"
    )


def _build_resource(service_name: str):
    from opentelemetry.sdk.resources import Resource

    return Resource.create(
        {
            "service.name": service_name,
            "service.namespace": SERVICE_NAMESPACE,
            "deployment.environment": os.environ.get("DEPLOY_ENV", "dev"),
        }
    )


def _flush_and_shutdown() -> None:
    """atexit hook: force-flush then shutdown both providers. Never raises."""
    for provider in (_tracer_provider, _meter_provider):
        if provider is None:
            continue
        try:
            provider.force_flush(timeout_millis=5000)
        except Exception:
            pass
        try:
            provider.shutdown()
        except Exception:
            pass


def init_telemetry(service_name: str, app: Any = None) -> None:
    """Initialise OTLP gRPC trace + metric exporters per SPEC §2.1/§2.2/§2.5.

    Honors OTEL_SDK_DISABLED. When ``app`` is a FastAPI/Flask instance, HTTP
    server instrumentation and the tenant middleware / hook are attached.
    Never raises.
    """
    global _initialized, _enabled, _tracer_provider, _meter_provider

    if _initialized:
        return
    _initialized = True

    if sdk_disabled():
        logger.info("otelkit: OTEL_SDK_DISABLED set — telemetry is a no-op")
        return

    try:
        from opentelemetry import metrics, trace
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
            OTLPMetricExporter,
        )
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.propagate import set_global_textmap
        from opentelemetry.propagators.composite import CompositePropagator
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.trace.sampling import (
            DEFAULT_ON,
            ParentBasedTraceIdRatio,
        )
        from opentelemetry.trace.propagation.tracecontext import (
            TraceContextTextMapPropagator,
        )
        try:  # renamed to W3CBaggagePropagator in SDK >= 1.40
            from opentelemetry.baggage.propagation import BaggagePropagator
        except ImportError:
            from opentelemetry.baggage.propagation import (
                W3CBaggagePropagator as BaggagePropagator,
            )
    except ImportError as exc:
        logger.warning("otelkit: opentelemetry packages unavailable (%s) — no-op", exc)
        return

    name = _resolve_service_name(service_name)
    endpoint = os.environ.get(
        "OTEL_EXPORTER_OTLP_ENDPOINT", DEFAULT_OTLP_ENDPOINT
    )
    try:
        ratio = float(os.environ.get("OTEL_TRACES_SAMPLER_ARG", "1.0"))
    except ValueError:
        ratio = 1.0
    if ratio >= 1.0:
        sampler = DEFAULT_ON  # always-on keeps every money-path span
    else:
        sampler = ParentBasedTraceIdRatio(ratio)

    try:
        resource = _build_resource(name)

        tracer_provider = TracerProvider(resource=resource, sampler=sampler)
        tracer_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
        )
        trace.set_tracer_provider(tracer_provider)
        _tracer_provider = tracer_provider

        meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[
                PeriodicExportingMetricReader(
                    OTLPMetricExporter(endpoint=endpoint),
                    export_interval_millis=30000,
                )
            ],
        )
        metrics.set_meter_provider(meter_provider)
        _meter_provider = meter_provider

        # W3C tracecontext + baggage everywhere (SPEC §2.4).
        set_global_textmap(
            CompositePropagator(
                [TraceContextTextMapPropagator(), BaggagePropagator()]
            )
        )

        _enabled = True
        atexit.register(_flush_and_shutdown)
        logger.info(
            "otelkit: initialised service=%s endpoint=%s sampler_ratio=%s",
            name,
            endpoint,
            ratio,
        )
    except Exception as exc:  # never break the service for telemetry
        logger.warning("otelkit: init failed (%s) — continuing without telemetry", exc)
        _tracer_provider = None
        _meter_provider = None
        _enabled = False
        return

    if app is not None:
        _instrument_app(app)


def _instrument_app(app: Any) -> None:
    """Attach HTTP server instrumentation + tenant attribution to a FastAPI or
    Flask app. Best-effort; never raises."""
    module = type(app).__module__
    try:
        if module.startswith("fastapi") or module.startswith("starlette"):
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

            FastAPIInstrumentor.instrument_app(app)
            from .middleware import TenantMiddleware

            app.add_middleware(TenantMiddleware)
        elif module.startswith("flask"):
            from opentelemetry.instrumentation.flask import FlaskInstrumentor

            FlaskInstrumentor().instrument_app(app)
            from .middleware import install_flask_tenant_hook

            install_flask_tenant_hook(app)
        else:
            logger.warning(
                "otelkit: unrecognised app type %s — HTTP instrumentation skipped",
                module,
            )
    except Exception as exc:
        logger.warning("otelkit: app instrumentation failed (%s)", exc)


def get_tracer(name: str = "otelkit"):
    """Return a tracer from the global provider (no-op tracer when disabled)."""
    from opentelemetry import trace

    return trace.get_tracer(name)


@contextmanager
def tb_span(op: str, **attributes: Any):
    """Client-side span around a TigerBeetle operation (SPEC §3 TigerBeetle row).

    Usage: ``with tb_span("transfer", payer=..., payee=..., amount=...):``
    Span kind=CLIENT, attributes prefixed ``tb.``; errors recorded + re-raised.
    """
    tracer = get_tracer("otelkit.tigerbeetle")
    attrs = {"tb.op": op}
    attrs.update({f"tb.{k}": v for k, v in attributes.items() if v is not None})
    with tracer.start_as_current_span(
        f"tigerbeetle.{op}",
        kind=_span_kind_client(),
        attributes=attrs,
    ) as span:
        yield span


def _span_kind_client():
    from opentelemetry.trace import SpanKind

    return SpanKind.CLIENT


def inc_counter(name: str, attrs: Optional[dict] = None) -> None:
    """Increment a sync counter on the global meter (contract addendum).

    No-op when the SDK is disabled or not yet initialised. Never raises.
    """
    if not _enabled:
        return
    try:
        from opentelemetry import metrics

        meter = metrics.get_meter("otelkit")
        meter.create_counter(name).add(1, attributes=attrs or {})
    except Exception:
        pass


# Re-export contract surface (lazy-safe: these modules import no heavy deps at
# module import time).
from .middleware import TenantMiddleware, install_flask_tenant_hook  # noqa: E402
from .instruments import (  # noqa: E402
    instrument_kafka,
    instrument_psycopg2,
    instrument_redis,
    instrument_requests,
    instrument_sqlalchemy,
)
from .temporal import temporal_interceptor  # noqa: E402
