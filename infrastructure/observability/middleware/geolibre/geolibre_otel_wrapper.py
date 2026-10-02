"""GeoLibre OpenTelemetry wrapper (illustrative integration snippet).

GeoLibre has NO native OpenTelemetry support. This module shows the manual
wrapper pattern: otelkit init at process start + one span per GeoLibre call,
with tenant attribution per SPEC §2.3.

Status: ILLUSTRATIVE — adapt to the actual service module that calls GeoLibre.
Requires: shared/otel/python/otelkit (B4), opentelemetry-sdk.
No secrets; endpoint via OTEL_EXPORTER_OTLP_ENDPOINT (otelkit default
http://otel-collector:4317, SPEC §2.1).
"""

from __future__ import annotations

from typing import Any, Optional

from opentelemetry import trace
from opentelemetry.trace import StatusCode

# SPEC §2.5 — Python kit entrypoint. Honors OTEL_SDK_DISABLED (SPEC §2.1).
from shared.otel.python.otelkit import init_telemetry

tracer = trace.get_tracer("geolibre-wrapper")


def init() -> None:
    """Call once at service startup, before the HTTP server starts."""
    init_telemetry(service_name="geolibre", app=None)  # app if FastAPI/Flask


def geolibre_call(
    fn,
    *args,
    operation: str,
    tenant_id: Optional[str] = None,
    **kwargs,
) -> Any:
    """Run a GeoLibre function inside a CLIENT span.

    Span attributes follow the SPEC conventions:
      - tenant.id            (SPEC §2.3; only when known)
      - geo.libre.operation  (vendor operation name)
    """
    with tracer.start_as_current_span(f"GeoLibre.{operation}") as span:
        span.set_attribute("geo.libre.operation", operation)
        if tenant_id:
            span.set_attribute("tenant.id", tenant_id)
        try:
            result = fn(*args, **kwargs)
            return result
        except Exception as exc:  # record and re-raise — no behavior change
            span.record_exception(exc)
            span.set_status(StatusCode.ERROR, str(exc))
            raise


# --- usage example -----------------------------------------------------------
# import geolibre
#
# init()
# zones = geolibre_call(
#     geolibre.zones_within_radius,
#     lat=6.5244, lon=3.3792, radius_km=25,
#     operation="zones_within_radius",
#     tenant_id=request.headers.get("x-tenant-id"),  # SPEC §2.3 source order
# )
