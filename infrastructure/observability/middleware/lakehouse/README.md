# Lakehouse — direct instrumentation of `infrastructure/new/lakehouse/server.py`

**Mechanism (manual, in-process):** the lakehouse server is a plain
`http.server`-based Python app (verified-static), so instrumentation is a code
patch, not a config toggle.

## Patch

`work/w9/patches/py-lakehouse.diff` (applies with `git apply -p1` / `patch -p1`
against corebanking @ 1c9134e2; dry-run verified clean).

The diff is minimal and logic-preserving:

1. **Guarded import** of `shared.otel.python.otelkit.init_telemetry` +
   `opentelemetry.trace` — if either is absent, `init_telemetry`/`_tracer`
   become `None` and the server behaves exactly as before.
2. **`init_telemetry(service_name="lakehouse")`** in `main()` (only when the
   kit is importable). Endpoint/sampling come from env per SPEC §2.1
   (`OTEL_EXPORTER_OTLP_ENDPOINT` default `http://otel-collector:4317`,
   `OTEL_SDK_DISABLED` honored by the kit).
3. **Request spans**: `do_GET`/`do_POST` renamed to `_do_GET`/`_do_POST` and
   wrapped by `_serve_with_span`, creating one span per request named
   `lakehouse <METHOD> <path>` (path stripped of query string to bound
   cardinality) with attributes `http.request.method`, `url.path`, and
   `tenant.id` from the `x-tenant-id` header (SPEC §2.3). Handler bodies are
   byte-identical — no logic change.

## Validation performed

- `python3 -m ast` parse of the patched file: OK.
- Patch dry-run against the pinned tree: **applies clean**.
- Behavioral smoke test (module imported with stubbed deps):
  - kit absent → handlers run unchanged (no-op path verified);
  - fake tracer → span created with correct name/attributes incl. `tenant.id`.
- Runtime against real DuckDB/Delta stack: **requires-deployment** (not run).

## Dependencies / handoffs

- Needs the B4 Python kit (`shared/otel/python/otelkit`) importable at runtime;
  until it lands the patch is a verified no-op.
- The server also talks to Postgres (`pg_extractor`) and Kafka (`cdc/streaming`);
  when those paths need deeper spans, add `instrument_psycopg2()` /
  `instrument_kafka()` from the kit — deliberately NOT included to keep the
  diff minimal.

## Limitations

- Handlers swallow exceptions and return HTTP 500, so spans do not currently
  record error status on the 500 path (would require touching handler logic —
  excluded by the "no logic change" constraint).
- No metrics endpoint is added (the server has none; out of scope for this
  minimal patch).
