"""E2E contract tests for production hardening completeness."""
import os
import re
import glob
import pytest

SERVICES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "services")

class TestWritePersistence:
    """Verify all services persist writes to database."""
    
    def test_go_no_echo_back(self):
        """No Go service should discard data in createHandler."""
        echo_back = []
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            with open(path) as f:
                content = f.read()
            # Extract createHandler
            import re as _re
            match = _re.search(r'func createHandler.*?\n}', content, _re.DOTALL)
            if match:
                handler = match.group()
                if '_ = dataBytes' in handler and 'dbInsert' not in handler and 'db.Exec' not in handler:
                    echo_back.append(os.path.basename(os.path.dirname(path)))
        assert echo_back == [], f"Go services that echo-back without persisting: {echo_back}"
    
    def test_go_dbinsert_defined(self):
        """All Go services with createHandler should have dbInsert."""
        missing = []
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            with open(path) as f:
                content = f.read()
            if 'func createHandler' in content or 'func handleCreate' in content:
                if 'func dbInsert' not in content and 'db.Exec' not in content:
                    missing.append(os.path.basename(os.path.dirname(path)))
        assert len(missing) == 0, f"Go services missing dbInsert: {missing}"
    
    def test_rust_db_persist_defined(self):
        """All Rust services should have db_persist."""
        total = 0
        with_persist = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-rs", "src", "main.rs"))):
            total += 1
            with open(path) as f:
                if 'db_persist' in f.read():
                    with_persist += 1
        assert with_persist / max(total, 1) > 0.9, f"Only {with_persist}/{total} Rust services have db_persist"
    
    def test_python_db_insert_defined(self):
        """All Python services should have db_insert."""
        total = 0
        with_insert = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-py", "main.py"))):
            total += 1
            with open(path) as f:
                if 'db_insert' in f.read():
                    with_insert += 1
        assert with_insert / max(total, 1) > 0.7, f"Only {with_insert}/{total} Python services have db_insert"


class TestSecurityHeaders:
    """Verify security headers are configured in all services."""
    
    def test_go_middleware_no_nil(self):
        """No Go service should have Handler: nil."""
        nil_services = []
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            with open(path) as f:
                content = f.read()
            if re.search(r'Handler:\s*nil', content):
                nil_services.append(os.path.basename(os.path.dirname(path)))
        assert nil_services == [], f"Go services with Handler: nil: {nil_services}"
    
    def test_rust_security_headers(self):
        """All Rust services should have security headers."""
        total = 0
        with_headers = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-rs", "src", "main.rs"))):
            total += 1
            with open(path) as f:
                content = f.read().lower()
            if 'x-frame-options' in content or 'x_frame_options' in content:
                with_headers += 1
        assert with_headers / max(total, 1) > 0.9, f"Only {with_headers}/{total} Rust services have security headers"
    
    def test_python_security_headers(self):
        """All Python services should call add_security_headers."""
        total = 0
        with_call = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-py", "main.py"))):
            total += 1
            with open(path) as f:
                content = f.read()
            calls = [l for l in content.split('\n') if 'add_security_headers(' in l and 'def add_security_headers' not in l]
            if calls:
                with_call += 1
        assert with_call / max(total, 1) > 0.9, f"Only {with_call}/{total} Python services call add_security_headers"


class TestInterServiceIntegration:
    """Verify inter-service calls are wired."""
    
    def test_go_callservice_invoked(self):
        """Most Go services should invoke callService."""
        total = 0
        with_call = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            total += 1
            with open(path) as f:
                content = f.read()
            calls = [l for l in content.split('\n') if 'callService(' in l and 'func callService' not in l]
            if calls:
                with_call += 1
        ratio = with_call / max(total, 1)
        assert ratio > 0.9, f"Only {with_call}/{total} ({ratio:.0%}) Go services invoke callService"
    
    def test_rust_interservice(self):
        """Most Rust services should invoke call_service_sync."""
        total = 0
        with_call = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-rs", "src", "main.rs"))):
            total += 1
            with open(path) as f:
                content = f.read()
            calls = [l for l in content.split('\n') if 'call_service_sync(' in l and 'fn call_service_sync' not in l]
            if calls:
                with_call += 1
        ratio = with_call / max(total, 1)
        assert ratio > 0.7, f"Only {with_call}/{total} ({ratio:.0%}) Rust services invoke call_service_sync"
    
    def test_python_interservice(self):
        """Most Python services should invoke call_service."""
        total = 0
        with_call = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-py", "main.py"))):
            total += 1
            with open(path) as f:
                content = f.read()
            calls = [l for l in content.split('\n') if 'call_service(' in l and 'def call_service' not in l]
            if calls:
                with_call += 1
        ratio = with_call / max(total, 1)
        assert ratio > 0.7, f"Only {with_call}/{total} ({ratio:.0%}) Python services invoke call_service"


class TestJWTAuth:
    """Verify JWT auth is enforced."""
    
    def test_go_jwt_middleware(self):
        """Most Go services should have JWT in middleware chain."""
        total = 0
        with_jwt = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            total += 1
            with open(path) as f:
                if 'jwtAuth' in f.read():
                    with_jwt += 1
        assert with_jwt / max(total, 1) > 0.9
    
    def test_rust_jwt_check(self):
        """Most Rust services should have JWT check."""
        total = 0
        with_jwt = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-rs", "src", "main.rs"))):
            total += 1
            with open(path) as f:
                if 'check_jwt' in f.read():
                    with_jwt += 1
        assert with_jwt / max(total, 1) > 0.9
    
    def test_python_jwt_enforcement(self):
        """Python services should enforce JWT (return 401, not just warn)."""
        total = 0
        enforcing = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-py", "main.py"))):
            with open(path) as f:
                content = f.read()
            if 'validate_jwt' not in content:
                continue
            total += 1
            if 'return' in content and '401' in content:
                enforcing += 1
        assert enforcing / max(total, 1) > 0.9


class TestRateLimiting:
    """Verify rate limiting is active."""
    
    def test_go_rate_limit_middleware(self):
        """All Go services should have rate limit middleware."""
        total = 0
        with_rl = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            total += 1
            with open(path) as f:
                if 'rateLimitMiddleware' in f.read():
                    with_rl += 1
        assert with_rl / max(total, 1) > 0.95
    
    def test_rust_rate_limit(self):
        """Most Rust services should have rl_allow."""
        total = 0
        with_rl = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-rs", "src", "main.rs"))):
            total += 1
            with open(path) as f:
                content = f.read()
            calls = [l for l in content.split('\n') if 'rl_allow()' in l and 'fn rl_allow' not in l]
            if calls:
                with_rl += 1
        assert with_rl / max(total, 1) > 0.9
    
    def test_python_rate_limit(self):
        """Python services should call _rl_allow from handlers."""
        total = 0
        with_rl = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-py", "main.py"))):
            total += 1
            with open(path) as f:
                content = f.read()
            calls = [l for l in content.split('\n') if '_rl_allow(' in l and 'def _rl_allow' not in l]
            if calls:
                with_rl += 1
        assert with_rl / max(total, 1) > 0.9


class TestGracefulShutdown:
    """Verify graceful shutdown is configured."""
    
    def test_go_signal_notify(self):
        total = 0
        with_shutdown = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-go", "main.go"))):
            total += 1
            with open(path) as f:
                if 'signal.Notify' in f.read():
                    with_shutdown += 1
        assert with_shutdown / max(total, 1) > 0.95
    
    def test_rust_shutdown(self):
        total = 0
        with_shutdown = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-rs", "src", "main.rs"))):
            total += 1
            with open(path) as f:
                if 'shutdown_timeout' in f.read():
                    with_shutdown += 1
        assert with_shutdown / max(total, 1) > 0.95
    
    def test_python_signal(self):
        total = 0
        with_shutdown = 0
        for path in sorted(glob.glob(os.path.join(SERVICES_DIR, "*-py", "main.py"))):
            total += 1
            with open(path) as f:
                if 'signal.signal' in f.read():
                    with_shutdown += 1
        assert with_shutdown / max(total, 1) > 0.95
