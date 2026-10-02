"""
Failed Login Tracking — real unit tests (redis-backed, c3-0883).

The tracker counter now lives in redis (`failed_login:{tenant}:{email}`,
INCR + EXPIRE-on-first, 900s window). These tests inject an in-process
``_FakeRedis`` implementing the exact redis commands the tracker uses
(INCR/EXPIRE/GET/DELETE) with real wall-clock TTL expiry, and assert the
security contract:

- each failed attempt increments the counter and decrements `remaining`
- the suspension hook fires exactly when MAX_ATTEMPTS is reached
- the lockout window is set on suspension
- reset_attempts() fully clears the counter
- counters are isolated per tenant and per email
- a stale window (TTL expired) resets the count
- redis outage is FAIL-CLOSED: record/get_remaining raise
  LoginTrackerUnavailable; reset_attempts logs and swallows
- integration test against a real redis is skipped unless REDIS_URL is set

Note: running the full pytest module requires the service venv (the
``utils`` package __init__ imports dapr). The tracker logic itself is
verified standalone by the wave-12 gate harness.
"""

import os
import time

import pytest
import redis as redis_lib

from utils.failed_login_tracker import FailedLoginTracker, LoginTrackerUnavailable


class _FakeRedis:
    """Minimal real-semantics redis double: INCR/EXPIRE/GET/DELETE with TTL."""

    def __init__(self):
        self._data = {}  # key -> (value, expires_at_epoch_or_None)

    def _expired(self, key):
        item = self._data.get(key)
        if item is not None and item[1] is not None and time.time() >= item[1]:
            del self._data[key]
            return True
        return False

    def incr(self, key):
        self._expired(key)
        value, exp = self._data.get(key, (0, None))
        value += 1
        self._data[key] = (value, exp)
        return value

    def expire(self, key, seconds):
        if key in self._data:
            self._data[key] = (self._data[key][0], time.time() + seconds)
            return True
        return False

    def get(self, key):
        self._expired(key)
        item = self._data.get(key)
        return None if item is None else str(item[0])

    def delete(self, key):
        self._expired(key)
        return 1 if self._data.pop(key, None) is not None else 0

    # test helper: force the TTL of a key into the past
    def force_expire(self, key):
        if key in self._data:
            self._data[key] = (self._data[key][0], time.time() - 1)


class _DownRedis:
    """Every command raises ConnectionError — simulates a redis outage."""

    def __getattr__(self, name):
        def _boom(*args, **kwargs):
            raise redis_lib.ConnectionError("simulated redis outage")

        return _boom


class _MockDB:
    """The tracker never touches the session for counter tracking."""

    pass


def _make_tracker(redis_client=None):
    tracker = FailedLoginTracker(_MockDB(), redis_client=redis_client or _FakeRedis())
    # Replace the external suspension call with a recording stub.
    calls = []

    def fake_suspend(keycloak_id, tenant_id, email):
        calls.append({"keycloak_id": keycloak_id, "tenant_id": tenant_id, "email": email})
        return True

    tracker._suspend_account = fake_suspend
    return tracker, calls


def test_attempts_increment_and_remaining_counts_down():
    tracker, calls = _make_tracker()
    email, tenant, kc = "user@example.com", "tenant-a", "kc-1"

    for i in range(1, FailedLoginTracker.MAX_ATTEMPTS):
        result = tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id=kc)
        assert result["attempts"] == i, f"attempt {i}: got {result['attempts']}"
        assert result["remaining"] == FailedLoginTracker.MAX_ATTEMPTS - i
        assert result["suspended"] is False, "must not suspend before MAX_ATTEMPTS"
        assert result["lockout_until"] is None

    assert calls == [], "suspension hook must not fire before the threshold"


def test_suspension_triggered_at_max_attempts():
    tracker, calls = _make_tracker()
    email, tenant, kc = "brute@example.com", "tenant-a", "kc-2"

    result = None
    for _ in range(FailedLoginTracker.MAX_ATTEMPTS):
        result = tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id=kc)

    assert result["attempts"] == FailedLoginTracker.MAX_ATTEMPTS
    assert result["remaining"] == 0
    assert result["suspended"] is True
    assert result["lockout_until"] is not None
    assert len(calls) == 1
    assert calls[0]["keycloak_id"] == kc

    # Further attempts keep counting but must not re-fire the hook twice
    # in the same check — the hook fires per record call over threshold.
    tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id=kc)
    assert len(calls) == 2


def test_reset_attempts_clears_counter():
    tracker, _ = _make_tracker()
    email, tenant = "reset@example.com", "tenant-a"

    for _ in range(3):
        tracker.record_failed_attempt(email=email, tenant_id=tenant)
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS - 3

    tracker.reset_attempts(email, tenant)
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS


def test_counters_isolated_per_tenant_and_email():
    tracker, _ = _make_tracker()

    tracker.record_failed_attempt(email="a@example.com", tenant_id="tenant-1")
    tracker.record_failed_attempt(email="a@example.com", tenant_id="tenant-2")
    tracker.record_failed_attempt(email="a@example.com", tenant_id="tenant-2")
    tracker.record_failed_attempt(email="b@example.com", tenant_id="tenant-1")

    assert tracker.get_remaining_attempts("a@example.com", "tenant-1") == FailedLoginTracker.MAX_ATTEMPTS - 1
    assert tracker.get_remaining_attempts("a@example.com", "tenant-2") == FailedLoginTracker.MAX_ATTEMPTS - 2
    assert tracker.get_remaining_attempts("b@example.com", "tenant-1") == FailedLoginTracker.MAX_ATTEMPTS - 1


def test_expired_window_resets_count():
    fake = _FakeRedis()
    tracker, _ = _make_tracker(redis_client=fake)
    email, tenant = "stale@example.com", "tenant-a"

    for _ in range(4):
        tracker.record_failed_attempt(email=email, tenant_id=tenant)

    fake.force_expire(f"failed_login:{tenant}:{email}")

    # Window expired: next failure starts a fresh window at 1.
    result = tracker.record_failed_attempt(email=email, tenant_id=tenant)
    assert result["attempts"] == 1
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS - 1


def test_redis_outage_is_fail_closed():
    tracker, _ = _make_tracker(redis_client=_DownRedis())
    email, tenant = "down@example.com", "tenant-a"

    with pytest.raises(LoginTrackerUnavailable):
        tracker.record_failed_attempt(email=email, tenant_id=tenant)

    with pytest.raises(LoginTrackerUnavailable):
        tracker.get_remaining_attempts(email, tenant)

    # reset is logs-only: must swallow the outage, never raise.
    tracker.reset_attempts(email, tenant)


@pytest.mark.skipif(
    not os.environ.get("REDIS_URL"),
    reason="integration test requires a real redis (set REDIS_URL)",
)
def test_real_redis_roundtrip():
    import redis

    client = redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    tracker, calls = _make_tracker(redis_client=client)
    email, tenant = f"it-{time.time_ns()}@example.com", "tenant-it"
    key = f"failed_login:{tenant}:{email}"
    client.delete(key)
    try:
        result = tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id="kc-it")
        assert result["attempts"] == 1
        ttl = client.ttl(key)
        assert 0 < ttl <= FailedLoginTracker.WINDOW_SECONDS
        tracker.reset_attempts(email, tenant)
        assert client.get(key) is None
        assert calls == []
    finally:
        client.delete(key)
