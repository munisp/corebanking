"""
Failed Login Tracking — real unit tests.

H-40 remediation: the previous version of this file only printed values and
two of its four "tests" were pure print narratives of example API responses.
Nothing could ever fail.

These tests drive the real ``utils.failed_login_tracker.FailedLoginTracker``
(its attempt counter is in-memory; the external suspension API call is
monkeypatched so no network is involved) and assert the security contract:

- each failed attempt increments the counter and decrements `remaining`
- the suspension hook fires exactly when MAX_ATTEMPTS is reached
- the lockout window is set on suspension
- reset_attempts() fully clears the counter
- counters are isolated per tenant and per email
- a stale window (first attempt older than LOCKOUT_DURATION) resets the count
"""

from datetime import datetime, timedelta

from utils.failed_login_tracker import FailedLoginTracker


class _MockDB:
    """The tracker never touches the session for in-memory tracking."""

    pass


def _make_tracker():
    tracker = FailedLoginTracker(_MockDB())
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
    assert result["suspended"] is True, "suspension must trigger at MAX_ATTEMPTS"
    assert result["lockout_until"] is not None
    assert result["lockout_until"] > datetime.utcnow(), "lockout window must be in the future"

    assert len(calls) == 1, "suspension hook must fire exactly once"
    assert calls[0] == {"keycloak_id": kc, "tenant_id": tenant, "email": email}


def test_suspension_failure_is_reported_not_swallowed():
    tracker, _ = _make_tracker()
    tracker._suspend_account = lambda **kwargs: False  # external API failed

    result = None
    for _ in range(FailedLoginTracker.MAX_ATTEMPTS):
        result = tracker.record_failed_attempt(
            email="x@example.com", tenant_id="tenant-a", keycloak_id="kc-x"
        )
    assert result["suspended"] is False, (
        "a failed suspension call must surface as suspended=False — never claim success"
    )


def test_no_keycloak_id_does_not_suspend_but_still_counts():
    tracker, calls = _make_tracker()
    result = None
    for _ in range(FailedLoginTracker.MAX_ATTEMPTS):
        result = tracker.record_failed_attempt(email="nokc@example.com", tenant_id="tenant-a")
    assert result["attempts"] == FailedLoginTracker.MAX_ATTEMPTS
    assert result["suspended"] is False
    assert calls == [], "no keycloak_id → no suspension call possible"


def test_reset_attempts_after_successful_login():
    tracker, _ = _make_tracker()
    email, tenant = "reset@example.com", "tenant-a"

    for _ in range(3):
        tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id="kc-3")
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS - 3

    tracker.reset_attempts(email, tenant)
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS


def test_unknown_user_has_full_attempts():
    tracker, _ = _make_tracker()
    assert tracker.get_remaining_attempts("ghost@example.com", "tenant-a") == FailedLoginTracker.MAX_ATTEMPTS


def test_counters_isolated_per_tenant_and_email():
    tracker, _ = _make_tracker()
    tracker.record_failed_attempt(email="a@example.com", tenant_id="t1", keycloak_id="k1")
    tracker.record_failed_attempt(email="a@example.com", tenant_id="t1", keycloak_id="k1")

    assert tracker.get_remaining_attempts("a@example.com", "t1") == FailedLoginTracker.MAX_ATTEMPTS - 2
    assert tracker.get_remaining_attempts("a@example.com", "t2") == FailedLoginTracker.MAX_ATTEMPTS
    assert tracker.get_remaining_attempts("b@example.com", "t1") == FailedLoginTracker.MAX_ATTEMPTS


def test_stale_window_resets_counter():
    tracker, _ = _make_tracker()
    email, tenant = "stale@example.com", "tenant-a"

    for _ in range(3):
        tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id="kc-4")
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS - 3

    # Age the first attempt beyond the lockout window.
    tracker._cache[f"{tenant}:{email}"]["first_attempt"] = (
        datetime.utcnow() - timedelta(minutes=FailedLoginTracker.LOCKOUT_DURATION_MINUTES + 1)
    )

    # Next failed attempt starts a fresh window: attempts == 1, not 4.
    result = tracker.record_failed_attempt(email=email, tenant_id=tenant, keycloak_id="kc-4")
    assert result["attempts"] == 1, f"stale window must reset the counter, got {result['attempts']}"
    assert tracker.get_remaining_attempts(email, tenant) == FailedLoginTracker.MAX_ATTEMPTS - 1


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
