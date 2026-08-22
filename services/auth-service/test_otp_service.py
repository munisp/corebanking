"""
OTP Service — real unit tests.

H-40 remediation: the previous version of this file printed values and never
asserted anything (and two of its five "tests" were pure print narratives).
It also accessed ``otp_data['code']``, which the Redis-backed OTPService
deliberately no longer returns — the file was both vacuous and stale.

These tests drive the real ``utils.otp_service.OTPService`` against an
in-memory Redis double and assert the security-critical contract:

- the OTP code is NEVER returned by the API surface (only expires_at)
- a correct code verifies exactly once (replay is rejected)
- wrong codes decrement the remaining-attempts counter
- exceeding MAX_ATTEMPTS destroys the OTP
- invalidate_otp() wipes both the OTP and the attempt counter
- get_otp_status() exposes metadata but never the code
"""

import importlib.util
import sys
import types
from datetime import datetime, timezone

# The service module imports the `redis` client library at import time. It is
# only used through the `_get_redis()` seam, which these tests patch, so a
# minimal stub is enough when the dependency is unavailable locally.
if importlib.util.find_spec("redis") is None:  # pragma: no cover
    _redis_stub = types.ModuleType("redis")
    _redis_stub.Redis = object  # only referenced as a type annotation
    _redis_stub.from_url = lambda *a, **k: None  # never called: _get_redis is patched
    sys.modules.setdefault("redis", _redis_stub)

from utils.otp_service import OTPService
import utils.otp_service as otp_module


class _FakePipeline:
    """Minimal transactional pipeline matching the redis-py call surface used."""

    def __init__(self, store):
        self._store = store
        self._ops = []

    def hset(self, key, mapping=None):
        self._ops.append(("hset", key, mapping))
        return self

    def expire(self, key, seconds):
        self._ops.append(("expire", key, seconds))
        return self

    def delete(self, *keys):
        self._ops.append(("delete", keys, None))
        return self

    def execute(self):
        for op, key, val in self._ops:
            if op == "hset":
                self._store["hash"].setdefault(key, {}).update(val)
            elif op == "expire":
                self._store["ttl"][key] = val
            elif op == "delete":
                for k in key:
                    self._store["hash"].pop(k, None)
                    self._store["str"].pop(k, None)
                    self._store["ttl"].pop(k, None)
        self._ops = []
        return True


class FakeRedis:
    """In-memory stand-in implementing exactly what OTPService uses."""

    def __init__(self):
        self._store = {"hash": {}, "str": {}, "ttl": {}}

    # pipeline
    def pipeline(self, transaction=True):
        return _FakePipeline(self._store)

    # hashes
    def hset(self, key, field=None, value=None, mapping=None):
        h = self._store["hash"].setdefault(key, {})
        if mapping:
            h.update(mapping)
        else:
            h[field] = value
        return 1

    def hgetall(self, key):
        return dict(self._store["hash"].get(key, {}))

    def hget(self, key, field):
        return self._store["hash"].get(key, {}).get(field)

    # strings / counters
    def incr(self, key):
        cur = int(self._store["str"].get(key, "0")) + 1
        self._store["str"][key] = str(cur)
        return cur

    def get(self, key):
        return self._store["str"].get(key)

    # keyspace
    def delete(self, *keys):
        n = 0
        for k in keys:
            for kind in ("hash", "str"):
                if k in self._store[kind]:
                    del self._store[kind][k]
                    n += 1
            self._store["ttl"].pop(k, None)
        return n

    def expire(self, key, seconds):
        self._store["ttl"][key] = seconds
        return True

    def ttl(self, key):
        return self._store["ttl"].get(key, -2)


def _make_service():
    fake = FakeRedis()
    # Patch the module-level accessor so OTPService uses the fake.
    original = otp_module._get_redis
    otp_module._get_redis = lambda: fake
    return OTPService(), fake, original


def _restore(original):
    otp_module._get_redis = original


def _read_code(fake, tenant_id, keycloak_id):
    """Peek at the stored code (test-only; production API never exposes it)."""
    key = OTPService._OTP_KEY.format(tenant_id=tenant_id, keycloak_id=keycloak_id)
    return fake.hgetall(key)["code"]


def test_generate_otp_returns_expiry_but_never_the_code():
    svc, fake, orig = _make_service()
    try:
        result = svc.generate_otp("kc-1", "tenant-a", "user@example.com")
        assert "expires_at" in result, "generate_otp must return expires_at"
        assert "code" not in result, "generate_otp must NEVER return the OTP code"
        expires = datetime.fromisoformat(result["expires_at"])
        assert expires > datetime.now(timezone.utc), "expires_at must be in the future"
        # The code must exist server-side, be 6 digits, and expire via TTL.
        code = _read_code(fake, "tenant-a", "kc-1")
        assert len(code) == svc.OTP_LENGTH and code.isdigit()
        otp_key = OTPService._OTP_KEY.format(tenant_id="tenant-a", keycloak_id="kc-1")
        assert fake.ttl(otp_key) == svc.OTP_EXPIRY_SECONDS
    finally:
        _restore(orig)


def test_verify_correct_otp_exactly_once():
    svc, fake, orig = _make_service()
    try:
        svc.generate_otp("kc-2", "tenant-a", "user@example.com")
        code = _read_code(fake, "tenant-a", "kc-2")

        first = svc.verify_otp("kc-2", "tenant-a", code)
        assert first["valid"] is True, f"correct OTP must verify: {first}"

        replay = svc.verify_otp("kc-2", "tenant-a", code)
        assert replay["valid"] is False, "replayed OTP must be rejected"
        assert "already used" in replay["message"].lower()
    finally:
        _restore(orig)


def test_wrong_code_counts_down_attempts_then_locks_out():
    svc, fake, orig = _make_service()
    try:
        svc.generate_otp("kc-3", "tenant-a", "user@example.com")
        real_code = _read_code(fake, "tenant-a", "kc-3")
        wrong = "000000" if real_code != "000000" else "111111"

        for attempt in range(1, svc.MAX_ATTEMPTS + 1):
            res = svc.verify_otp("kc-3", "tenant-a", wrong)
            assert res["valid"] is False
            assert res["attempts_remaining"] == svc.MAX_ATTEMPTS - attempt, (
                f"attempt {attempt}: attempts_remaining={res.get('attempts_remaining')}, "
                f"want {svc.MAX_ATTEMPTS - attempt}"
            )

        # One attempt past the limit destroys the OTP entirely.
        res = svc.verify_otp("kc-3", "tenant-a", wrong)
        assert res["valid"] is False
        assert "maximum" in res["message"].lower()

        # Even the CORRECT code must now fail — the OTP is gone.
        res = svc.verify_otp("kc-3", "tenant-a", real_code)
        assert res["valid"] is False, "OTP must be destroyed after max attempts"
        assert "no otp found" in res["message"].lower()
    finally:
        _restore(orig)


def test_verify_without_enrollment_fails_closed():
    svc, fake, orig = _make_service()
    try:
        res = svc.verify_otp("never-enrolled", "tenant-a", "123456")
        assert res["valid"] is False
        assert "no otp found" in res["message"].lower()
    finally:
        _restore(orig)


def test_otp_is_scoped_per_tenant_and_user():
    svc, fake, orig = _make_service()
    try:
        svc.generate_otp("kc-4", "tenant-a", "user@example.com")
        code = _read_code(fake, "tenant-a", "kc-4")

        # Same code, wrong tenant → must not verify.
        assert svc.verify_otp("kc-4", "tenant-b", code)["valid"] is False
        # Same code, wrong user → must not verify.
        assert svc.verify_otp("kc-other", "tenant-a", code)["valid"] is False
        # Right pair verifies.
        assert svc.verify_otp("kc-4", "tenant-a", code)["valid"] is True
    finally:
        _restore(orig)


def test_regeneration_resets_attempt_counter():
    svc, fake, orig = _make_service()
    try:
        svc.generate_otp("kc-5", "tenant-a", "user@example.com")
        real = _read_code(fake, "tenant-a", "kc-5")
        wrong = "999999" if real != "999999" else "888888"
        svc.verify_otp("kc-5", "tenant-a", wrong)
        svc.verify_otp("kc-5", "tenant-a", wrong)

        # A fresh OTP must reset the throttle (delete of the attempt key).
        svc.generate_otp("kc-5", "tenant-a", "user@example.com")
        attempt_key = OTPService._ATTEMPT_KEY.format(tenant_id="tenant-a", keycloak_id="kc-5")
        assert fake.get(attempt_key) is None, "regeneration must reset the attempt counter"

        new_code = _read_code(fake, "tenant-a", "kc-5")
        assert svc.verify_otp("kc-5", "tenant-a", new_code)["valid"] is True
    finally:
        _restore(orig)


def test_invalidate_otp_wipes_state():
    svc, fake, orig = _make_service()
    try:
        svc.generate_otp("kc-6", "tenant-a", "user@example.com")
        code = _read_code(fake, "tenant-a", "kc-6")
        svc.invalidate_otp("kc-6", "tenant-a")
        res = svc.verify_otp("kc-6", "tenant-a", code)
        assert res["valid"] is False, "invalidated OTP must not verify"
        assert "no otp found" in res["message"].lower()
    finally:
        _restore(orig)


def test_status_exposes_metadata_but_never_code():
    svc, fake, orig = _make_service()
    try:
        assert svc.get_otp_status("kc-7", "tenant-a") is None, "no OTP → no status"
        svc.generate_otp("kc-7", "tenant-a", "user@example.com")
        status = svc.get_otp_status("kc-7", "tenant-a")
        assert status is not None and status["exists"] is True
        assert status["verified"] is False
        assert status["attempts_used"] == 0
        assert status["ttl_seconds"] > 0
        assert "code" not in status, "status endpoint must never leak the code"
    finally:
        _restore(orig)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
