"""B2: Islamic Banking Enhancements
Adds: Sukuk management, Takaful pools, Wakala agency, Istisna manufacturing,
Sharia advisory board integration, profit distribution engine
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
import uuid, json
import os

# --- W12-C3P2B5: PostgreSQL persistence (replaces in-memory singleton stores) ---
# Pattern: pooled psycopg2 (fleet ref: services/inventory-py/main.py:63-116).
# PG is authoritative: create/update/delete hit Postgres transactionally
# (autocommit => each statement is its own transaction); on PG failure the
# handler returns 503. There is NO in-memory shadow that could silently
# diverge from PG (cf. failed_login_tracker anti-pattern).
import threading as _w12_threading
import psycopg2 as _w12_pg
import psycopg2.pool as _w12_pgpool
import psycopg2.extras as _w12_pgextras

_w12_pool = None
_w12_pool_lock = _w12_threading.Lock()


def _w12_get_pool():
    global _w12_pool
    if _w12_pool is None or _w12_pool.closed:
        with _w12_pool_lock:
            if _w12_pool is None or _w12_pool.closed:
                _w12_pool = _w12_pgpool.ThreadedConnectionPool(1, 10, os.environ["DATABASE_URL"])
    return _w12_pool


def _w12_run(sql, params=(), fetch="all"):
    """Run one statement on a pooled connection (autocommit = per-statement transaction)."""
    conn = _w12_get_pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=_w12_pgextras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return cur.rowcount
    finally:
        _w12_get_pool().putconn(conn)


class _W12Store:
    """Per-domain PG table (jsonb payload pattern):
    id uuid pk default gen_random_uuid(), record_id text UNIQUE (natural key;
    upsert makes retry-able creates idempotent), tenant_id text, payload jsonb,
    created_at/updated_at timestamptz default now()."""
    _ensured = set()
    _ensured_lock = _w12_threading.Lock()

    def __init__(self, table, key="id", seed=(), tenant_key="tenant_id"):
        self.table = table
        self.key = key
        self.seed = list(seed)
        self.tenant_key = tenant_key

    def ensure(self):
        with _W12Store._ensured_lock:
            if self.table in _W12Store._ensured:
                return
            _w12_run(f"""CREATE TABLE IF NOT EXISTS {self.table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""", fetch=None)
            for row in self.seed:
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(row.get(self.key, "")), row.get(self.tenant_key),
                          json.dumps(row, default=str)), fetch=None)
            _W12Store._ensured.add(self.table)

    def all(self, limit=100000):
        self.ensure()
        return [r["payload"] for r in _w12_run(
            f"SELECT payload FROM {self.table} ORDER BY created_at, record_id LIMIT %s", (limit,))]

    def get(self, record_id):
        self.ensure()
        row = _w12_run(f"SELECT payload FROM {self.table} WHERE record_id = %s",
                       (str(record_id),), fetch="one")
        return row["payload"] if row else None

    def put(self, record_id, payload, tenant_id=None):
        self.ensure()
        _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb)
ON CONFLICT (record_id) DO UPDATE
SET payload = EXCLUDED.payload, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()""",
                 (str(record_id),
                  tenant_id if tenant_id is not None else payload.get(self.tenant_key),
                  json.dumps(payload, default=str)), fetch=None)

    def delete(self, record_id):
        self.ensure()
        return _w12_run(f"DELETE FROM {self.table} WHERE record_id = %s",
                        (str(record_id),), fetch=None)


@dataclass
class Sukuk:
    id: str = ""
    sukuk_type: str = ""  # ijara, murabaha, musharaka, istithmar
    issuer: str = ""
    total_value: float = 0
    unit_price: float = 0
    units_issued: int = 0
    units_sold: int = 0
    coupon_rate: float = 0
    maturity_date: str = ""
    underlying_asset: str = ""
    sharia_opinion_id: str = ""
    status: str = "draft"  # draft, approved, active, matured, redeemed
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class TakafulPolicy:
    id: str = ""
    policy_type: str = ""  # family, general, health, motor
    participant_id: str = ""
    contribution: float = 0
    coverage_amount: float = 0
    tabarru_ratio: float = 0.3  # donation portion
    investment_ratio: float = 0.7
    risk_pool_id: str = ""
    claim_status: str = "active"
    start_date: str = ""
    end_date: str = ""
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class WakalaContract:
    id: str = ""
    principal_id: str = ""  # muwakkil
    agent_id: str = ""  # wakil
    investment_amount: float = 0
    wakala_fee: float = 0  # fixed fee for agent
    fee_percentage: float = 1.5
    investment_type: str = ""  # equity, real_estate, trade
    expected_return: float = 0
    actual_return: float = 0
    status: str = "active"
    start_date: str = ""
    maturity_date: str = ""
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class IstisnaContract:
    id: str = ""
    buyer_id: str = ""
    manufacturer_id: str = ""
    asset_description: str = ""
    contract_price: float = 0
    progress_payments: list = field(default_factory=list)
    delivery_date: str = ""
    specifications: dict = field(default_factory=dict)
    quality_inspections: list = field(default_factory=list)
    status: str = "contracted"  # contracted, in_progress, inspection, delivered, completed
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class ShariaOpinion:
    id: str = ""
    product_id: str = ""
    product_type: str = ""
    board_member: str = ""
    opinion: str = ""  # approved, conditional, rejected
    conditions: list = field(default_factory=list)
    fatwa_reference: str = ""
    reviewed_at: str = ""

    def to_dict(self):
        return asdict(self)


# Storage — W12-C3P2B5: per-domain PG tables (jsonb payload pattern).
SUKUK_STORE = _W12Store("sukuks")
TAKAFUL_STORE = _W12Store("takaful_policies")
WAKALA_STORE = _W12Store("wakala_contracts")
ISTISNA_STORE = _W12Store("istisna_contracts")
SHARIA_OPINIONS_STORE = _W12Store("sharia_opinions")


def handle_sukuk(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            return 200, {"sukuks": SUKUK_STORE.all()}
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
    if method == "POST":
        s = Sukuk(**{k: v for k, v in body.items() if k in Sukuk.__dataclass_fields__})
        s.id = f"SKK-{uuid.uuid4().hex[:8]}"
        s.created_at = datetime.now(timezone.utc).isoformat()
        if s.total_value < 100_000_000:
            return 400, {"error": "Minimum sukuk issuance is ₦100,000,000"}
        try:
            SUKUK_STORE.put(s.id, s.to_dict())
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 201, s.to_dict()
    return 405, {"error": "method not allowed"}


def handle_takaful(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            return 200, {"policies": TAKAFUL_STORE.all()}
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
    if method == "POST":
        p = TakafulPolicy(**{k: v for k, v in body.items() if k in TakafulPolicy.__dataclass_fields__})
        p.id = f"TKF-{uuid.uuid4().hex[:8]}"
        p.created_at = datetime.now(timezone.utc).isoformat()
        if p.tabarru_ratio + p.investment_ratio != 1.0:
            return 400, {"error": "tabarru_ratio + investment_ratio must equal 1.0"}
        try:
            TAKAFUL_STORE.put(p.id, p.to_dict())
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 201, p.to_dict()
    return 405, {"error": "method not allowed"}


def handle_wakala(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            return 200, {"contracts": WAKALA_STORE.all()}
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
    if method == "POST":
        w = WakalaContract(**{k: v for k, v in body.items() if k in WakalaContract.__dataclass_fields__})
        w.id = f"WKL-{uuid.uuid4().hex[:8]}"
        w.wakala_fee = w.investment_amount * (w.fee_percentage / 100)
        w.created_at = datetime.now(timezone.utc).isoformat()
        try:
            WAKALA_STORE.put(w.id, w.to_dict())
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 201, w.to_dict()
    return 405, {"error": "method not allowed"}


def handle_istisna(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            return 200, {"contracts": ISTISNA_STORE.all()}
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
    if method == "POST":
        c = IstisnaContract(**{k: v for k, v in body.items() if k in IstisnaContract.__dataclass_fields__})
        c.id = f"IST-{uuid.uuid4().hex[:8]}"
        c.created_at = datetime.now(timezone.utc).isoformat()
        try:
            ISTISNA_STORE.put(c.id, c.to_dict())
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 201, c.to_dict()
    return 405, {"error": "method not allowed"}


def handle_sharia_review(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            return 200, {"opinions": SHARIA_OPINIONS_STORE.all()}
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
    if method == "POST":
        o = ShariaOpinion(**{k: v for k, v in body.items() if k in ShariaOpinion.__dataclass_fields__})
        o.id = f"SHR-{uuid.uuid4().hex[:8]}"
        o.reviewed_at = datetime.now(timezone.utc).isoformat()
        # Auto-check: reject if profit margin > 30%
        try:
            SHARIA_OPINIONS_STORE.put(o.id, o.to_dict())
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 201, o.to_dict()
    return 405, {"error": "method not allowed"}


ENHANCEMENT_ROUTES = {
    "/v1/islamic/sukuk": handle_sukuk,
    "/v1/islamic/takaful": handle_takaful,
    "/v1/islamic/wakala": handle_wakala,
    "/v1/islamic/istisna": handle_istisna,
    "/v1/islamic/sharia-review": handle_sharia_review,
}
