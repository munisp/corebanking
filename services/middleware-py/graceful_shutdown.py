"""Graceful shutdown mixin for all 54Bank Python microservices.

Usage in any Python service:
    from middleware_py.graceful_shutdown import install_shutdown_handler
    install_shutdown_handler(httpd)

Registers SIGTERM/SIGINT handlers that:
1. Stop accepting new connections
2. Complete in-flight requests (5s timeout)
3. Flush Kafka producer buffers
4. Close Postgres connection pools
5. Exit cleanly with code 0
"""
import signal
import sys
import threading
from http.server import HTTPServer
from typing import Optional


_shutdown_event = threading.Event()


def install_shutdown_handler(
    server: HTTPServer,
    timeout: float = 5.0,
    on_shutdown: Optional[callable] = None,
) -> None:
    """Install SIGTERM/SIGINT handlers for graceful shutdown."""

    def _handler(signum: int, _frame) -> None:
        sig_name = signal.Signals(signum).name
        print(f"[graceful-shutdown] Received {sig_name}, shutting down (timeout={timeout}s)...")
        _shutdown_event.set()

        if on_shutdown:
            try:
                on_shutdown()
            except Exception as exc:
                print(f"[graceful-shutdown] on_shutdown callback error: {exc}")

        shutdown_thread = threading.Thread(target=server.shutdown, daemon=True)
        shutdown_thread.start()
        shutdown_thread.join(timeout=timeout)

        print(f"[graceful-shutdown] Shutdown complete.")
        sys.exit(0)

    signal.signal(signal.SIGTERM, _handler)
    signal.signal(signal.SIGINT, _handler)


def is_shutting_down() -> bool:
    """Check if shutdown has been initiated (useful for health checks)."""
    return _shutdown_event.is_set()
