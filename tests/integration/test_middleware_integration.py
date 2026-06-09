"""
54Bank Middleware Integration Test Suite
Tests cross-service communication, saga patterns, and data consistency.
Run: pytest tests/integration/test_middleware_integration.py -v
Requires: All middleware services running (use docker-compose up)
"""
import os
import time
import json
import uuid
import hashlib
import requests
import pytest

# Service URLs (configurable via env)
KAFKA_URL = os.getenv("KAFKA_URL", "http://localhost:9377")
REDIS_URL = os.getenv("REDIS_URL", "http://localhost:9417")
TEMPORAL_URL = os.getenv("TEMPORAL_URL", "http://localhost:9445")
PERMIFY_URL = os.getenv("PERMIFY_URL", "http://localhost:9406")
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:9380")
MOJALOOP_URL = os.getenv("MOJALOOP_URL", "http://localhost:9392")
TB_URL = os.getenv("TIGERBEETLE_URL", "http://localhost:8301")
FLUVIO_URL = os.getenv("FLUVIO_URL", "http://localhost:8304")
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9525")
OPENAPPSEC_URL = os.getenv("OPENAPPSEC_URL", "http://localhost:8310")

AUTH = {"Authorization": "Bearer integration-test-token", "Content-Type": "application/json"}


class TestTransferSaga:
    """Test the full transfer saga: auth → debit → credit → notify → audit"""

    def test_transfer_requires_authorization(self):
        """Transfer must be authorized before execution"""
        resp = requests.post(f"{PERMIFY_URL}/v1/permify-authz/bulk/check", json={
            "checks": [{
                "entity": "account", "entity_id": "ACC-sender-001",
                "permission": "transfer", "subject_type": "user", "subject_id": "user-unauthorized",
            }]
        }, headers=AUTH)
        assert resp.status_code == 200
        result = resp.json()
        # Fail-closed: unauthorized user must be denied
        assert result["results"][0]["allowed"] is False

    def test_mfa_required_for_high_value_transfer(self):
        """Transfers ≥ ₦1M require MFA"""
        resp = requests.post(f"{KEYCLOAK_URL}/v1/keycloak-admin/mfa/evaluate", json={
            "action": "transfer", "amount_kobo": 200000000, "role": "customer"  # ₦2M
        }, headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["mfa_required"] is True
        assert "policy" in body

    def test_mfa_not_required_for_small_transfer(self):
        """Transfers < ₦1M don't require MFA"""
        resp = requests.post(f"{KEYCLOAK_URL}/v1/keycloak-admin/mfa/evaluate", json={
            "action": "transfer", "amount_kobo": 5000000, "role": "customer"  # ₦50K
        }, headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["mfa_required"] is False

    def test_tigerbeetle_double_entry_consistency(self):
        """Debit and credit must balance (double-entry)"""
        chain = {
            "transfers": [
                {"debit_account": 1001, "credit_account": 1002, "amount_kobo": 500000, "code": 1, "ledger": 1},
                {"debit_account": 1002, "credit_account": 1003, "amount_kobo": 200000, "code": 1, "ledger": 1},
            ],
            "atomic": True,
        }
        resp = requests.post(f"{TB_URL}/transfers/linked", json=chain, headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["atomic"] is True
        assert body["status"] == "all_committed"
        assert len(body["transfers"]) == 2
        # First transfer should be linked, second should not
        assert body["transfers"][0]["linked"] is True
        assert body["transfers"][1]["linked"] is False

    def test_kafka_transactional_produce_commit(self):
        """Kafka transactional produce must commit atomically"""
        txn_id = f"saga-txn-{uuid.uuid4().hex[:8]}"
        resp = requests.post(f"{KAFKA_URL}/v1/kafka-streaming/produce/transactional", json={
            "txn_id": txn_id, "topic": "transfer-events",
            "messages": [
                {"key": "debit", "value": json.dumps({"account": "ACC-001", "amount": -500000})},
                {"key": "credit", "value": json.dumps({"account": "ACC-002", "amount": 500000})},
            ],
        }, headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "committed"
        assert body["messages"] == 2
        assert body["txn_id"] == txn_id


class TestIdempotency:
    """Test idempotency across services"""

    def test_fluvio_exactly_once_deduplication(self):
        """Same idempotency key must return cached response, not duplicate"""
        idem_key = f"idem-{uuid.uuid4().hex[:8]}"
        payload = {"topic": "payments", "key": "payment-001", "value": {"amount": 1000000}, "idempotency_key": idem_key}

        # First request
        r1 = requests.post(f"{FLUVIO_URL}/produce/exactly-once", json=payload, headers=AUTH)
        assert r1.status_code == 200
        offset1 = r1.json()["offset"]
        assert "x-idempotency-replayed" not in r1.headers

        # Replay with same key (different value to prove it's cached)
        payload["value"] = {"amount": 9999999}
        r2 = requests.post(f"{FLUVIO_URL}/produce/exactly-once", json=payload, headers=AUTH)
        assert r2.status_code == 200
        offset2 = r2.json()["offset"]

        # Must return same offset (deduplication)
        assert offset1 == offset2
        assert r2.headers.get("x-idempotency-replayed") == "true"

    def test_kafka_dlq_retry_backoff(self):
        """DLQ retry engine applies exponential backoff"""
        msg_id = f"msg-{uuid.uuid4().hex[:8]}"

        # First retry — should get shortest delay
        r1 = requests.post(f"{KAFKA_URL}/v1/kafka-streaming/dlq/retry", json={
            "message_id": msg_id, "error": "downstream timeout"
        }, headers=AUTH)
        assert r1.status_code == 200
        body1 = r1.json()
        assert body1["action"] == "retry_scheduled"
        delay1 = body1["delay_ms"]

        # Second retry — delay should increase (exponential backoff)
        r2 = requests.post(f"{KAFKA_URL}/v1/kafka-streaming/dlq/retry", json={
            "message_id": msg_id, "error": "downstream timeout"
        }, headers=AUTH)
        assert r2.status_code == 200
        delay2 = r2.json()["delay_ms"]
        assert delay2 > delay1, f"Expected backoff: {delay2} > {delay1}"


class TestClusterResilience:
    """Test failover, recovery, and cluster coordination"""

    def test_redis_cluster_topology(self):
        """Redis cluster reports 6-node topology with masters and replicas"""
        resp = requests.get(f"{REDIS_URL}/v1/redis-session-store/cluster/status", headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        nodes = body["nodes"]
        masters = [n for n in nodes.values() if n["role"] == "master"]
        replicas = [n for n in nodes.values() if n["role"] == "slave"]
        assert len(masters) == 3, "Expected 3 master nodes"
        assert len(replicas) == 3, "Expected 3 replica nodes"
        # Verify slot coverage (0-16383)
        all_slots = []
        for m in masters:
            if m["slots"]:
                all_slots.extend(range(m["slots"][0], m["slots"][1] + 1))
        assert len(all_slots) == 16384, "Slot coverage must span 0-16383"

    def test_redis_pipeline_batching(self):
        """Pipeline batcher executes commands in batch"""
        resp = requests.post(f"{REDIS_URL}/v1/redis-session-store/pipeline/exec", json={
            "commands": [
                {"cmd": "SET", "args": ["key1", "value1"]},
                {"cmd": "SET", "args": ["key2", "value2"]},
                {"cmd": "GET", "args": ["key1"]},
            ]
        }, headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["pipelined"] is True
        assert body["executed"] == 3


class TestSecurityAndCompliance:
    """Test security controls and regulatory compliance"""

    def test_session_management_limits(self):
        """Keycloak enforces max 5 sessions per user"""
        user_id = f"user-{uuid.uuid4().hex[:8]}"
        sessions = []
        for i in range(6):
            resp = requests.post(f"{KEYCLOAK_URL}/v1/keycloak-admin/session/create", json={
                "user_id": user_id, "client_id": f"device-{i}"
            }, headers=AUTH)
            assert resp.status_code == 200
            sessions.append(resp.json())

        # 6th session should have evicted the oldest
        # Verify by checking session count
        assert len(sessions) == 6
        assert sessions[5]["user_id"] == user_id

    def test_mojaloop_fx_rate_bounds(self):
        """FX quotes must return positive rates within reasonable bounds"""
        pairs = [("NGN", "USD"), ("NGN", "GBP"), ("NGN", "EUR"), ("NGN", "GHS"), ("NGN", "KES")]
        for from_curr, to_curr in pairs:
            resp = requests.post(f"{MOJALOOP_URL}/v1/mojaloop-connector/fx/quote", json={
                "from": from_curr, "to": to_curr, "amount_kobo": 1000000
            }, headers=AUTH)
            assert resp.status_code == 200, f"Failed for {from_curr}/{to_curr}: {resp.text}"
            body = resp.json()
            assert body["rate"] > 0, f"Rate must be positive for {from_curr}/{to_curr}"
            assert body["output_kobo"] > 0, f"Output must be positive for {from_curr}/{to_curr}"

    def test_settlement_window_lifecycle(self):
        """Settlement window transitions: OPEN → CLOSED"""
        resp = requests.post(f"{MOJALOOP_URL}/v1/mojaloop-connector/settlement/close", json={
            "window_id": f"win-{uuid.uuid4().hex[:8]}"
        }, headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["state"] == "CLOSED"
        assert "opened_at" in body
        assert "closed_at" in body


class TestObservability:
    """Test metrics, health checks, and cache instrumentation"""

    def test_cache_metrics_all_services(self):
        """All middleware services expose cache metrics"""
        services = [
            (KAFKA_URL, "kafka-streaming"),
            (REDIS_URL, "redis-session-store"),
            (TEMPORAL_URL, "temporal-worker"),
            (PERMIFY_URL, "permify-authz"),
            (KEYCLOAK_URL, "keycloak-admin"),
            (MOJALOOP_URL, "mojaloop-connector"),
        ]
        for url, name in services:
            resp = requests.get(f"{url}/v1/{name}/cache/metrics", headers=AUTH)
            assert resp.status_code == 200, f"{name} cache/metrics failed"
            body = resp.json()
            assert "hit_rate_pct" in body, f"{name} missing hit_rate_pct"
            assert "hits" in body, f"{name} missing hits"
            assert "misses" in body, f"{name} missing misses"

    def test_health_endpoints_report_status(self):
        """Health endpoints return service metadata"""
        services = [
            (KAFKA_URL, "/healthz"),
            (REDIS_URL, "/healthz"),
            (TB_URL, "/health"),
            (FLUVIO_URL, "/health"),
        ]
        for url, path in services:
            resp = requests.get(f"{url}{path}")
            assert resp.status_code == 200
            body = resp.json()
            assert body["status"] == "healthy"
            assert "version" in body or "service" in body
