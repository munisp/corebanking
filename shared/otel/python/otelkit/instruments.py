"""Client instrumentation helpers (SPEC §2.5).

Each helper is best-effort: if the target library or its OpenTelemetry
instrumentation package is missing, or the SDK is disabled, the call is a
logged no-op and NEVER raises into service code.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("otelkit.instruments")


def _disabled() -> bool:
    # Local import to avoid a hard cycle at module import time.
    from . import sdk_disabled

    return sdk_disabled()


def instrument_sqlalchemy(engine: Any = None) -> None:
    """Instrument SQLAlchemy. ``engine`` may be an Engine, or None to
    instrument all engines created afterwards."""
    if _disabled():
        return
    try:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        if engine is not None:
            SQLAlchemyInstrumentor().instrument(engine=engine)
        else:
            SQLAlchemyInstrumentor().instrument()
    except Exception as exc:
        logger.warning("otelkit: sqlalchemy instrumentation skipped (%s)", exc)


def instrument_psycopg2() -> None:
    if _disabled():
        return
    try:
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

        Psycopg2Instrumentor().instrument()
    except Exception as exc:
        logger.warning("otelkit: psycopg2 instrumentation skipped (%s)", exc)


def instrument_redis() -> None:
    if _disabled():
        return
    try:
        from opentelemetry.instrumentation.redis import RedisInstrumentor

        RedisInstrumentor().instrument()
    except Exception as exc:
        logger.warning("otelkit: redis instrumentation skipped (%s)", exc)


def instrument_kafka() -> None:
    """Instrument kafka-python producers/consumers (tracecontext injected into
    message headers per SPEC §2.4)."""
    if _disabled():
        return
    try:
        from opentelemetry.instrumentation.kafka import KafkaInstrumentor

        KafkaInstrumentor().instrument()
    except Exception as exc:
        logger.warning("otelkit: kafka-python instrumentation skipped (%s)", exc)


def instrument_requests() -> None:
    """Instrument both ``requests`` and ``httpx`` outbound HTTP clients."""
    if _disabled():
        return
    try:
        from opentelemetry.instrumentation.requests import RequestsInstrumentor

        RequestsInstrumentor().instrument()
    except Exception as exc:
        logger.warning("otelkit: requests instrumentation skipped (%s)", exc)
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except Exception as exc:
        logger.warning("otelkit: httpx instrumentation skipped (%s)", exc)
