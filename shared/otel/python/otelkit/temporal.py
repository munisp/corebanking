"""Temporal workflow tracing interceptor (SPEC §2.5, §3 Temporal row).

Uses temporalio's contrib OpenTelemetry interceptor
(``temporalio.contrib.opentelemetry.TracingInterceptor``) which propagates
W3C tracecontext through workflow/activity headers.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger("otelkit.temporal")


def temporal_interceptor(tracer: Optional[Any] = None) -> Optional[Any]:
    """Return the temporalio OpenTelemetry TracingInterceptor, or None.

    Returns None (logged, never raises) when temporalio or its opentelemetry
    contrib extra is not installed, or when OTEL_SDK_DISABLED is set.
    Pass the result to ``temporalio.client.Client(..., interceptors=[...])``
    and ``temporalio.worker.Worker(..., interceptors=[...])``.
    """
    from . import sdk_disabled

    if sdk_disabled():
        return None
    try:
        from temporalio.contrib.opentelemetry import TracingInterceptor

        if tracer is None:
            from . import get_tracer

            tracer = get_tracer("otelkit.temporal")
        return TracingInterceptor(tracer)
    except Exception as exc:
        logger.warning("otelkit: temporal interceptor unavailable (%s)", exc)
        return None
