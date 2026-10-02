# GeoLibre — manual Python wrapper instrumentation

## Honest scope

**GeoLibre has no native OpenTelemetry support** and — verified-static —
**does not appear anywhere in this repo** (no imports, deployments, or config
reference `geolibre`; closest geospatial path is Apache Sedona in
`kpi-analytics-py`). This integration is therefore a **guidance wrapper** for
whatever service ends up calling GeoLibre, not a patch to existing code.

## Files

| File | Purpose | Status |
|---|---|---|
| `geolibre_otel_wrapper.py` | Python snippet: `init_telemetry("geolibre")` from the shared Python kit (SPEC §2.5) + a `geolibre_call()` helper that wraps any GeoLibre function in a CLIENT span with `tenant.id` (SPEC §2.3) and error recording | illustrative (requires an actual caller service) |

## How to use

1. Ensure `shared/otel/python/otelkit` (B4 deliverable) is importable and
   `OTEL_EXPORTER_OTLP_ENDPOINT` is set (default `http://otel-collector:4317`,
   SPEC §2.1).
2. In the calling service: `from geolibre_otel_wrapper import init, geolibre_call`,
   call `init()` at startup, then wrap every GeoLibre invocation.
3. Propagate `tenant.id` from `x-tenant-id` header per SPEC §2.3.

## Limitations

- No metrics endpoint, no server-side tracing — wrapper spans are the entire
  telemetry surface.
- If GeoLibre makes outbound HTTP calls internally, add
  `otelkit.instrument_requests()` at init so those calls become child spans and
  propagate W3C `tracecontext` (SPEC §2.4).
- The snippet is not wired into any repo service (none uses GeoLibre today);
  the B4 Python patches cover the services that actually exist.
