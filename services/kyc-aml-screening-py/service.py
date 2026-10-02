"""54link-dev KYC/AML Screening Service — Know Your Customer & Anti-Money Laundering.

BVN verification, PEP/sanctions watchlist screening, risk scoring, and
enhanced due diligence triggers. Nigerian regulatory compliance (CBN KYC Tiers).

Real-dependency behavior (no silent mockware):
- BVN verification calls the real NIBSS BVN API (NIBSS_BVN_API_URL + NIBSS_API_KEY).
  Missing config or upstream failure -> HTTP 503 {"error": "bvn_provider_unavailable"}.
- PEP/sanctions screening loads watchlists from Postgres (screening_watchlist table,
  seeded from the official OFAC SDN / UN Consolidated lists when WATCHLIST_AUTO_SEED=true).
  Missing/empty lists -> HTTP 503 {"error": "sanctions_list_unavailable"} (fail closed).
- /healthz actively probes every dependency and reports per-component status.
- Demo seed records (KYC_SEED_DEMO_DATA=true, non-production only) use
  OBVIOUSLY SYNTHETIC identities ("Demo Person A", BVN "00000000001") marked
  demo=true — no real-looking names, BVNs, or phone numbers.
- A KYC record created with empty/insufficient identity data is NEVER
  auto-cleared: its screening_status is "incomplete".

Middleware: Kafka, Redis, Postgres, OpenSearch, NIBSS BVN Validation.
"""

from __future__ import annotations
import os, uuid, json, re, csv, io, socket, difflib, threading
import urllib.request, urllib.error
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict

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


def _w12_get_by(store, field, value):
    """First row whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    row = _w12_run(f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s LIMIT 1",
                   (field, value), fetch="one")
    return row["payload"] if row else None


def _w12_all_by(store, field, value, limit=100000):
    """All rows whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    rows = _w12_run(
        f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s ORDER BY created_at, record_id LIMIT %s",
        (field, value, limit))
    return [r["payload"] for r in rows]
from datetime import datetime, timezone
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
import os
import json
import re

# W12 B5-P1-F: real OpenSearch screening client (replaces SQL ILIKE candidate
# narrowing). Import is side-effect free (env-only); network happens per call.
import opensearch_screening as _os_screen


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


# ── Configuration ──

DATABASE_URL = os.environ.get("DATABASE_URL", "")
NIBSS_BVN_API_URL = os.environ.get("NIBSS_BVN_API_URL", "")
NIBSS_API_KEY = os.environ.get("NIBSS_API_KEY", "")
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "")
REDIS_URL = os.environ.get("REDIS_URL", "")
# W12 B5-P1-F: OPENSEARCH_URL is the fleet-canonical env (docker-compose.yml
# gateway, opensearch-indexer-py); OPENSEARCH_ENDPOINT kept for back-compat.
OPENSEARCH_URL = (os.environ.get("OPENSEARCH_URL")
                  or os.environ.get("OPENSEARCH_ENDPOINT", "")).rstrip("/")
KEYCLOAK_URL = os.environ.get("KEYCLOAK_REALM_URL", "")
APP_ENV = os.environ.get("APP_ENV", "production").lower()
WATCHLIST_AUTO_SEED = os.environ.get("WATCHLIST_AUTO_SEED", "").lower() == "true"
# W11 PY-449: watchlist/candidate caches use a 60s TTL.
WATCHLIST_CACHE_TTL_SECONDS = int(os.environ.get("WATCHLIST_CACHE_TTL_SECONDS", "60"))
FUZZY_MATCH_THRESHOLD = float(os.environ.get("SCREENING_MATCH_THRESHOLD", "80"))
HTTP_PROBE_TIMEOUT = float(os.environ.get("HEALTH_PROBE_TIMEOUT_SECONDS", "3"))

# Official downloadable sanctions sources (used only when WATCHLIST_AUTO_SEED=true)
OFAC_SDN_CSV_URL = os.environ.get(
    "OFAC_SDN_CSV_URL", "https://www.treasury.gov/ofac/downloads/sdn.csv")
UN_CONSOLIDATED_XML_URL = os.environ.get(
    "UN_CONSOLIDATED_XML_URL", "https://scsanctions.un.org/resources/xml/en/consolidated.xml")


class BVNProviderUnavailable(Exception):
    """Raised when the NIBSS BVN API is not configured or unreachable."""


class ScreeningUnavailable(Exception):
    """Raised when sanctions/PEP watchlists cannot be loaded (fail closed)."""


# ── Enums ──

class KYCTier(str, Enum):
    TIER1 = "tier1"   # Basic: BVN + phone, max ₦300K balance, ₦50K daily
    TIER2 = "tier2"   # Standard: + ID document, max ₦500K, ₦200K daily
    TIER3 = "tier3"   # Enhanced: + utility bill + ref letter, unlimited

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    PROHIBITED = "prohibited"

class ScreeningStatus(str, Enum):
    CLEAR = "clear"
    WATCHLIST_MATCH = "watchlist_match"
    PEP_MATCH = "pep_match"
    SANCTIONS_MATCH = "sanctions_match"
    PENDING_REVIEW = "pending_review"
    # Identity data was insufficient to run screening — never treat as clear.
    INCOMPLETE = "incomplete"


# ── Models ──

@dataclass
class KYCRecord:
    id: str
    customer_id: str
    bvn: str
    full_name: str
    date_of_birth: str
    phone: str
    email: str
    tier: str
    bvn_verified: bool
    bvn_verification_date: Optional[str]
    id_type: Optional[str]
    id_number: Optional[str]
    id_verified: bool
    address: Optional[str]
    address_verified: bool
    risk_score: int
    risk_level: str
    screening_status: str
    screening_notes: list[str]
    pep_check: bool
    sanctions_check: bool
    edd_required: bool
    last_screening_date: str
    documents: list[dict]
    created_at: str
    updated_at: str
    demo: bool = False

@dataclass
class ScreeningResult:
    id: str
    customer_id: str
    screening_type: str
    query_name: str
    matches: list[dict]
    risk_score: int
    status: str
    notes: str
    screened_at: str


# ── Watchlist Store (Postgres-backed, seeded from OFAC/UN) ──

WATCHLIST_DDL = """
CREATE TABLE IF NOT EXISTS screening_watchlist (
    id SERIAL PRIMARY KEY,
    list_type VARCHAR(16) NOT NULL,          -- 'pep' or 'sanctions'
    name TEXT NOT NULL,
    category TEXT,
    country VARCHAR(8),
    reason TEXT,
    risk VARCHAR(16),
    list_name VARCHAR(64),
    source VARCHAR(32),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

_watchlist_cache: dict = {"loaded_at": None, "pep": [], "sanctions": []}


def _get_db_connection():
    try:
        import psycopg2
    except ImportError:
        raise ScreeningUnavailable("psycopg2 driver not installed")
    if not DATABASE_URL:
        raise ScreeningUnavailable("DATABASE_URL not configured")
    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
        conn.autocommit = True
        return conn
    except Exception as e:
        raise ScreeningUnavailable(f"screening database unreachable: {e}")


def _download(url: str, max_bytes: int = 40 * 1024 * 1024) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "54link-kyc-aml-screening/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read(max_bytes)


def _parse_ofac_sdn_csv(raw: bytes) -> list[dict]:
    """Parse the OFAC SDN CSV. Column 2 holds the primary name."""
    entries = []
    reader = csv.reader(io.StringIO(raw.decode("utf-8", errors="replace")))
    for row in reader:
        if len(row) >= 2 and row[1].strip():
            remarks = row[-1] if row else ""
            entries.append({
                "name": row[1].strip(),
                "list_name": "OFAC SDN",
                "category": "sanctioned_entity",
                "country": "",
                "reason": remarks[:200] if remarks else "OFAC SDN listing",
                "risk": "prohibited",
                "source": "ofac",
            })
    return entries


def _parse_un_consolidated_xml(raw: bytes) -> list[dict]:
    """Parse the UN Consolidated Sanctions list (XML)."""
    entries = []
    root = ET.fromstring(raw.decode("utf-8", errors="replace"))
    for node in root.iter():
        tag = node.tag.split("}")[-1].upper()
        if tag not in ("INDIVIDUAL", "ENTITY"):
            continue
        first = node.findtext(".//FIRST_NAME") or ""
        second = node.findtext(".//SECOND_NAME") or ""
        third = node.findtext(".//THIRD_NAME") or ""
        fourth = node.findtext(".//FOURTH_NAME") or ""
        entity_name = node.findtext(".//NAME/ENTITY_NAME") or ""
        name = " ".join(p for p in [first, second, third, fourth] if p).strip() or entity_name.strip()
        if not name:
            continue
        nationality = node.findtext(".//NATIONALITY/VALUE") or ""
        entries.append({
            "name": name,
            "list_name": "UN Consolidated",
            "category": "individual" if tag == "INDIVIDUAL" else "entity",
            "country": nationality[:3] if nationality else "",
            "reason": "UN Security Council sanctions listing",
            "risk": "prohibited",
            "source": "un",
        })
    return entries


def _seed_watchlists(conn) -> int:
    """Seed the screening_watchlist table from official OFAC/UN downloads.

    Only runs when WATCHLIST_AUTO_SEED=true and the table is empty.
    Returns number of rows inserted.
    """
    inserted = 0
    with conn.cursor() as cur:
        for list_type, url, parser in (
            ("sanctions", OFAC_SDN_CSV_URL, _parse_ofac_sdn_csv),
            ("sanctions", UN_CONSOLIDATED_XML_URL, _parse_un_consolidated_xml),
        ):
            try:
                entries = parser(_download(url))
            except Exception as e:
                print(f"[kyc-aml] watchlist seed download failed for {url}: {e}")
                continue
            for e in entries:
                cur.execute(
                    "INSERT INTO screening_watchlist (list_type, name, category, country, reason, risk, list_name, source) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (list_type, e["name"], e.get("category"), e.get("country"),
                     e.get("reason"), e.get("risk"), e.get("list_name"), e.get("source")),
                )
                inserted += 1
    return inserted


def load_watchlists(force: bool = False) -> tuple[list[dict], list[dict]]:
    """Load PEP and sanctions watchlists from Postgres.

    Fails closed: raises ScreeningUnavailable if the table is missing, empty,
    or the database is unreachable. Never returns synthetic entries.
    """
    cached_at = _watchlist_cache["loaded_at"]
    if (not force and cached_at and
            (datetime.now(timezone.utc) - cached_at).total_seconds() < WATCHLIST_CACHE_TTL_SECONDS):
        return _watchlist_cache["pep"], _watchlist_cache["sanctions"]

    conn = _get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(WATCHLIST_DDL)
            cur.execute("SELECT COUNT(*) FROM screening_watchlist")
            count = cur.fetchone()[0]
            if count == 0 and WATCHLIST_AUTO_SEED and APP_ENV != "production":
                seeded = _seed_watchlists(conn)
                print(f"[kyc-aml] seeded {seeded} watchlist entries from OFAC/UN downloads")
                count = seeded
            if count == 0:
                raise ScreeningUnavailable(
                    "screening_watchlist table is empty — load OFAC/UN data before screening")
            cur.execute(
                "SELECT list_type, name, category, country, reason, risk, list_name "
                "FROM screening_watchlist WHERE name IS NOT NULL AND name <> ''"
            )
            pep, sanctions = [], []
            for list_type, name, category, country, reason, risk, list_name in cur.fetchall():
                entry = {"name": name, "category": category or "", "country": country or "",
                         "reason": reason or "", "risk": risk or "high", "list": list_name or ""}
                (pep if list_type == "pep" else sanctions).append(entry)
    finally:
        conn.close()

    if not sanctions and not pep:
        raise ScreeningUnavailable("no usable watchlist entries loaded")
    _watchlist_cache.update({"loaded_at": datetime.now(timezone.utc), "pep": pep, "sanctions": sanctions})
    return pep, sanctions


# ── W12 B5-P1-F: candidate retrieval via real OpenSearch ──
# History: W11 PY-449 narrowed candidates in SQL (WHERE name ILIKE ANY(...)
# LIMIT 50). That ILIKE matching is now replaced by real OpenSearch queries:
# screening_watchlist rows (the same real source, still seeded from OFAC/UN)
# are bulk-indexed into the sanctions-names / pep-names indices and matched
# with `match` + fuzziness=AUTO over an edge_ngram-analyzed name field
# (mappings: config/opensearch/*.json — stock 2.19.0 analyzers only, no
# phonetic plugin). Fail-closed contract unchanged: empty/missing table, DB
# failure, or OpenSearch unavailability raises ScreeningUnavailable; never
# returns synthetic entries.

_watchlist_ready_cache: dict = {"checked_at": None}
_screen_cache: dict = {}
_screen_cache_lock = threading.Lock()
_SCREEN_CACHE_MAX_ENTRIES = 1000
_os_sync_lock = threading.Lock()
_os_sync_state: dict = {"synced_at": None, "docs": 0}
# pep-enhanced-dd-py dual-writes curated entries into the shared pep-names
# index; inactive entries must never surface as screening candidates. Docs
# without an `active` field (watchlist-sourced) are unaffected by must_not.
_PEP_ACTIVE_FILTER = {"bool": {"must_not": [{"term": {"active": False}}]}}


def _cache_fresh(checked_at) -> bool:
    return bool(
        checked_at
        and (datetime.now(timezone.utc) - checked_at).total_seconds()
        < WATCHLIST_CACHE_TTL_SECONDS
    )


def _ensure_watchlist_ready() -> None:
    """Fail-closed readiness probe (cached 60s): the screening_watchlist
    table must exist and be non-empty before any name is screened."""
    if _cache_fresh(_watchlist_ready_cache["checked_at"]):
        return
    conn = _get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(WATCHLIST_DDL)
            cur.execute("SELECT COUNT(*) FROM screening_watchlist")
            count = cur.fetchone()[0]
            if count == 0 and WATCHLIST_AUTO_SEED and APP_ENV != "production":
                seeded = _seed_watchlists(conn)
                print(f"[kyc-aml] seeded {seeded} watchlist entries from OFAC/UN downloads")
                count = seeded
            if count == 0:
                raise ScreeningUnavailable(
                    "screening_watchlist table is empty — load OFAC/UN data before screening")
    finally:
        conn.close()
    _watchlist_ready_cache["checked_at"] = datetime.now(timezone.utc)


def _watchlist_doc(list_type: str, row: tuple) -> tuple[str, dict]:
    """Build an OpenSearch doc (natural _id = wl-{row id}) from a real
    screening_watchlist row — idempotent re-indexing."""
    row_id, _lt, name, category, country, reason, risk, list_name = row[:8]
    loaded_at = row[8] if len(row) > 8 else None
    return f"wl-{row_id}", {
        "watchlist_id": row_id,
        "list_type": list_type,
        "name": name,
        "name_normalized": _normalize_name(name),
        "category": category or "",
        "country": country or "",
        "reason": reason or "",
        "risk": risk or "high",
        "list_name": list_name or "",
        "loaded_at": loaded_at.isoformat() if hasattr(loaded_at, "isoformat") else None,
    }


def sync_watchlist_indices(force: bool = False) -> dict:
    """Bulk-index the real screening_watchlist rows into OpenSearch.

    Source of truth: the screening_watchlist Postgres table (the exact data
    the retired ILIKE ANY(...) query read). Idempotent via natural _id
    (wl-{id}); the watchlist is append-only in this service — entries are
    never deleted, so upsert-by-natural-id keeps the index consistent.
    Runs once per process unless forced (POST /v1/aml/opensearch/reindex).
    Raises ScreeningUnavailable on any failure (fail closed).
    """
    if not force and _os_sync_state["synced_at"]:
        return {"status": "already_synced", "docs": _os_sync_state["docs"],
                "syncedAt": _os_sync_state["synced_at"].isoformat()}
    with _os_sync_lock:
        if not force and _os_sync_state["synced_at"]:
            return {"status": "already_synced", "docs": _os_sync_state["docs"],
                    "syncedAt": _os_sync_state["synced_at"].isoformat()}
        _ensure_watchlist_ready()  # PG source must exist and be non-empty
        conn = _get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, list_type, name, category, country, reason, risk, "
                    "list_name, loaded_at FROM screening_watchlist "
                    "WHERE name IS NOT NULL AND name <> ''"
                )
                rows = cur.fetchall()
        except ScreeningUnavailable:
            raise
        except Exception as e:
            raise ScreeningUnavailable(f"watchlist read for opensearch sync failed: {e}")
        finally:
            conn.close()

        try:
            _os_screen.ensure_index(_os_screen.SANCTIONS_INDEX)
            _os_screen.ensure_index(_os_screen.PEP_INDEX)
            sanctions_docs = [_watchlist_doc("sanctions", r) for r in rows if r[1] != "pep"]
            pep_docs = [_watchlist_doc("pep", r) for r in rows if r[1] == "pep"]
            indexed = 0
            if sanctions_docs:
                indexed += _os_screen.bulk_index(_os_screen.SANCTIONS_INDEX, sanctions_docs)
            if pep_docs:
                indexed += _os_screen.bulk_index(_os_screen.PEP_INDEX, pep_docs)
        except _os_screen.OpenSearchUnavailable as e:
            raise ScreeningUnavailable(f"opensearch watchlist sync failed: {e}")

        _os_sync_state["synced_at"] = datetime.now(timezone.utc)
        _os_sync_state["docs"] = indexed
        return {"status": "synced", "docs": indexed,
                "sanctionsDocs": len(sanctions_docs), "pepDocs": len(pep_docs),
                "syncedAt": _os_sync_state["synced_at"].isoformat()}


def _ensure_indices_synced() -> None:
    if not _os_sync_state["synced_at"]:
        sync_watchlist_indices()


def _hit_to_watchlist_entry(hit: dict) -> dict:
    """Map an OpenSearch hit to the existing screening entry contract
    ({name, category, country, reason, risk, list}) unchanged for callers."""
    src = hit.get("_source", {})
    if src.get("entry_id"):
        # Curated pep_entries doc dual-written by pep-enhanced-dd-py into the
        # shared pep-names index: position/tier instead of category/reason.
        tier, position = src.get("tier", "") or "", src.get("position", "") or ""
        return {
            "name": src.get("name", ""),
            "category": position or "pep",
            "country": src.get("country", "") or "",
            "reason": (f"PEP {tier} — {position}" if (tier or position)
                       else "curated PEP listing"),
            "risk": src.get("risk") or "high",
            "list": src.get("list_name") or src.get("source") or "pep_entries",
        }
    return {
        "name": src.get("name", ""),
        "category": src.get("category") or "",
        "country": src.get("country") or "",
        "reason": src.get("reason") or "",
        "risk": src.get("risk") or "high",
        "list": src.get("list_name") or "",
    }


def _screening_candidates(name: str) -> tuple[list[dict], list[dict]]:
    """Return PEP/sanctions candidate entries for `name`, matched in OpenSearch.

    W12 B5-P1-F: candidates are retrieved from the real sanctions-names /
    pep-names indices (`match` + fuzziness=AUTO over an edge_ngram-analyzed
    name field, hard-capped by SCREENING_OS_CANDIDATE_LIMIT) instead of SQL
    ILIKE ANY(...). Fuzzy scoring (SCREENING_MATCH_THRESHOLD) then runs on
    those candidates exactly as before. Results are cached per
    (normalized name, match threshold, OS min_score) for 60s.
    """
    norm = _normalize_name(name)
    if not norm:
        _ensure_watchlist_ready()  # still fail closed on an empty/missing list
        return [], []
    cache_key = (norm, FUZZY_MATCH_THRESHOLD, _os_screen.SCREENING_MIN_SCORE)
    with _screen_cache_lock:
        entry = _screen_cache.get(cache_key)
        if entry and _cache_fresh(entry["fetched_at"]):
            return entry["pep"], entry["sanctions"]

    _ensure_watchlist_ready()
    _ensure_indices_synced()
    try:
        sanctions_hits = _os_screen.search_name_candidates(
            _os_screen.SANCTIONS_INDEX, name)
        pep_hits = _os_screen.search_name_candidates(
            _os_screen.PEP_INDEX, name, extra_filter=_PEP_ACTIVE_FILTER)
    except _os_screen.OpenSearchUnavailable as e:
        # Fail closed: a failed candidate query must never auto-clear.
        raise ScreeningUnavailable(f"watchlist candidate query failed: {e}")

    sanctions = [_hit_to_watchlist_entry(h) for h in sanctions_hits]
    pep = [_hit_to_watchlist_entry(h) for h in pep_hits]

    with _screen_cache_lock:
        if len(_screen_cache) >= _SCREEN_CACHE_MAX_ENTRIES:
            expired = [k for k, v in _screen_cache.items()
                       if not _cache_fresh(v["fetched_at"])]
            for k in expired:
                _screen_cache.pop(k, None)
            if len(_screen_cache) >= _SCREEN_CACHE_MAX_ENTRIES:
                _screen_cache.clear()
        _screen_cache[cache_key] = {
            "fetched_at": datetime.now(timezone.utc), "pep": pep, "sanctions": sanctions,
        }
    return pep, sanctions


# ── State ──

# W12-C3P2B5: PG-backed KYC/AML stores (tables kyc_records, screening_results).
#
# PII NOTICE (NDPR): kyc_records payloads contain BVN, national ID numbers,
# phone, email and address. At rest they rely on Postgres storage encryption
# (volume/TDE); field-level KMS envelope encryption is a TRACKED FOLLOW-UP —
# no envelope helper exists in this service today (see fix dispositions).
# RETENTION: CBN KYC retention is a minimum of 5 years after the customer
# relationship ends; purge/anonymization via scheduled job on
# kyc_records.updated_at is a follow-up (see dispositions).
KYC_STORE = _W12Store("kyc_records")
SCREENING_STORE = _W12Store("screening_results")


# ── Business Logic ──

def verify_bvn(bvn: str) -> tuple[bool, str]:
    """Verify a BVN against the real NIBSS BVN validation API.

    Fails closed: raises BVNProviderUnavailable when the provider is not
    configured or cannot be reached. Never returns a synthetic verdict.
    """
    if not re.match(r"^\d{11}$", bvn):
        return False, "BVN must be exactly 11 digits"
    if not NIBSS_BVN_API_URL or not NIBSS_API_KEY:
        raise BVNProviderUnavailable(
            "NIBSS BVN API not configured (set NIBSS_BVN_API_URL and NIBSS_API_KEY)")
    payload = json.dumps({"bvn": bvn}).encode()
    req = urllib.request.Request(
        NIBSS_BVN_API_URL.rstrip("/") + "/validate",
        data=payload, method="POST",
        headers={
            "Authorization": f"Bearer {NIBSS_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        # A well-formed provider rejection (e.g. BVN not found) is a real verdict.
        if e.code in (400, 404):
            try:
                data = json.loads(e.read().decode())
            except Exception:
                data = {}
            return False, data.get("message", "BVN not found")
        raise BVNProviderUnavailable(f"NIBSS BVN API returned HTTP {e.code}")
    except Exception as e:
        raise BVNProviderUnavailable(f"NIBSS BVN API unreachable: {e}")

    verified = bool(
        data.get("verified", False)
        or str(data.get("status", "")).lower() == "verified"
        or str(data.get("responseCode", "")) == "00"
    )
    message = (data.get("message") or data.get("responseMessage")
               or ("BVN verified successfully" if verified else "BVN verification failed"))
    return verified, message

def compute_risk_score(record: dict) -> tuple[int, str]:
    """Compute customer risk score (0-100). Higher = riskier."""
    score = 20  # Base score

    # BVN verification
    if not record.get("bvn_verified"):
        score += 30

    # PEP check
    if record.get("pep_match"):
        score += 25

    # Sanctions match
    if record.get("sanctions_match"):
        return 100, RiskLevel.PROHIBITED.value

    # High-risk countries (simplified)
    high_risk_countries = {"IR", "KP", "SY", "MM"}
    if record.get("nationality", "").upper() in high_risk_countries:
        score += 20

    # Transaction patterns
    if record.get("high_value_transactions", 0) > 10:
        score += 15

    # Missing documentation
    if not record.get("id_verified"):
        score += 10
    if not record.get("address_verified"):
        score += 10

    # Determine level
    if score >= 75:
        level = RiskLevel.HIGH.value
    elif score >= 45:
        level = RiskLevel.MEDIUM.value
    else:
        level = RiskLevel.LOW.value

    return min(score, 100), level


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (name or "").lower())).strip()


def _match_score(query: str, candidate: str) -> float:
    """Fuzzy name match score 0-100 using normalized token overlap + difflib ratio."""
    q, c = _normalize_name(query), _normalize_name(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 100.0
    q_parts, c_parts = set(q.split()), set(c.split())
    overlap = q_parts & c_parts
    token_score = len(overlap) / max(len(q_parts), len(c_parts)) * 100.0
    seq_score = difflib.SequenceMatcher(None, q, c).ratio() * 100.0
    score = max(token_score, seq_score)
    # Substring containment of a full normalized name is a strong signal.
    if (q in c or c in q) and min(len(q), len(c)) >= 6:
        score = max(score, 85.0)
    # Two or more shared tokens keeps precision on multi-part names.
    if len(overlap) >= 2:
        score = max(score, min(90.0, token_score + 15.0))
    return score


def screen_name(name: str) -> tuple[list[dict], str]:
    """Screen name against PEP and sanctions lists loaded from Postgres.

    Fails closed: raises ScreeningUnavailable when watchlists cannot be loaded;
    callers must treat this as 'cannot clear', never auto-clear.

    W12 B5-P1-F: candidates are retrieved from the real OpenSearch
    sanctions-names / pep-names indices (fuzzy match, 60s TTL cache keyed on
    (name, match threshold, OS min_score)) instead of SQL ILIKE narrowing.
    """
    pep_list, sanctions_list = _screening_candidates(name)
    matches = []

    # Check PEP list
    for pep in pep_list:
        score = _match_score(name, pep["name"])
        if score >= FUZZY_MATCH_THRESHOLD:
            matches.append({
                "type": "PEP",
                "matchedName": pep["name"],
                "category": pep.get("category", ""),
                "country": pep.get("country", ""),
                "riskLevel": pep.get("risk", "high"),
                "matchScore": round(score, 1),
            })

    # Check sanctions list
    for sanc in sanctions_list:
        score = _match_score(name, sanc["name"])
        if score >= FUZZY_MATCH_THRESHOLD:
            matches.append({
                "type": "SANCTIONS",
                "matchedName": sanc["name"],
                "list": sanc.get("list", ""),
                "country": sanc.get("country", ""),
                "reason": sanc.get("reason", ""),
                "matchScore": round(score, 1),
            })

    if any(m["type"] == "SANCTIONS" for m in matches):
        return matches, ScreeningStatus.SANCTIONS_MATCH.value
    if any(m["type"] == "PEP" for m in matches):
        return matches, ScreeningStatus.PEP_MATCH.value
    return matches, ScreeningStatus.CLEAR.value

def determine_kyc_tier(record: KYCRecord) -> str:
    """Determine CBN KYC tier based on documentation."""
    if record.address_verified and record.id_verified and record.bvn_verified:
        return KYCTier.TIER3.value
    if record.id_verified and record.bvn_verified:
        return KYCTier.TIER2.value
    return KYCTier.TIER1.value

KYC_TIER_LIMITS = {
    "tier1": {"maxBalance": 300000, "dailyLimit": 50000, "description": "Basic: BVN + Phone"},
    "tier2": {"maxBalance": 500000, "dailyLimit": 200000, "description": "Standard: + ID Document"},
    "tier3": {"maxBalance": None, "dailyLimit": None, "description": "Enhanced: + Address + Reference"},
}


# ── Seed Data (demo only — explicit opt-in, never in production) ──

def _seed():
    # OBVIOUSLY SYNTHETIC demo identities. No real names, BVNs, phone numbers,
    # or ID numbers: every field is a placeholder and every record carries
    # demo=True plus "DEMO-" identifiers.
    _demo_rows = [
        KYCRecord(
            id="DEMO-KYC-001", customer_id="DEMO-CUST-001", bvn="00000000001", full_name="Demo Person A",
            date_of_birth="1970-01-01", phone="+2340000000001", email="demo.person.a@example.invalid",
            tier="tier3", bvn_verified=True, bvn_verification_date="1970-01-01",
            id_type="demo_id", id_number="DEMO-00000001", id_verified=True,
            address="0 Demo Street, Demo City", address_verified=True,
            risk_score=20, risk_level="low", screening_status="clear", screening_notes=["demo record — not a real screening"],
            pep_check=True, sanctions_check=True, edd_required=False,
            last_screening_date="1970-01-01", documents=[
                {"type": "demo_id", "status": "demo", "uploadedAt": "1970-01-01"},
            ],
            created_at="1970-01-01T00:00:00Z", updated_at="1970-01-01T00:00:00Z",
            demo=True,
        ),
        KYCRecord(
            id="DEMO-KYC-002", customer_id="DEMO-CUST-002", bvn="00000000002", full_name="Demo Person B",
            date_of_birth="1970-01-01", phone="+2340000000002", email="demo.person.b@example.invalid",
            tier="tier2", bvn_verified=True, bvn_verification_date="1970-01-01",
            id_type="demo_id", id_number="DEMO-00000002", id_verified=True,
            address="0 Demo Avenue, Demo Town", address_verified=False,
            risk_score=35, risk_level="low", screening_status="clear", screening_notes=["demo record — not a real screening"],
            pep_check=True, sanctions_check=True, edd_required=False,
            last_screening_date="1970-01-01", documents=[
                {"type": "demo_id", "status": "demo", "uploadedAt": "1970-01-01"},
            ],
            created_at="1970-01-01T00:00:00Z", updated_at="1970-01-01T00:00:00Z",
            demo=True,
        ),
        KYCRecord(
            id="DEMO-KYC-003", customer_id="DEMO-CUST-003", bvn="00000000003", full_name="Demo Person C",
            date_of_birth="1970-01-01", phone="+2340000000003", email="demo.person.c@example.invalid",
            tier="tier1", bvn_verified=True, bvn_verification_date="1970-01-01",
            id_type=None, id_number=None, id_verified=False,
            address=None, address_verified=False,
            risk_score=50, risk_level="medium", screening_status="incomplete",
            screening_notes=["demo record — insufficient identity data, screening not run"],
            pep_check=False, sanctions_check=False, edd_required=False,
            last_screening_date="1970-01-01", documents=[],
            created_at="1970-01-01T00:00:00Z", updated_at="1970-01-01T00:00:00Z",
            demo=True,
        ),
    ]
    for _r in _demo_rows:
        try:
            KYC_STORE.put(_r.id, asdict(_r))
        except Exception as _e:
            print(f"W12-DEGRADED demo seed persist failed: {_e}")

# Demo records are clearly synthetic (Demo Person A/B/C, BVN 0000000000N,
# demo=True markers) and only load behind an explicit opt-in, never in production.
if os.environ.get("KYC_SEED_DEMO_DATA", "").lower() == "true" and APP_ENV != "production":
    _seed()


# ── Health Probes (real dependency checks, short timeouts) ──

def _probe_tcp(host: str, port: int, timeout: float = 2.0) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True, ""
    except Exception as e:
        return False, str(e)


def _probe_http(url: str, timeout: float = HTTP_PROBE_TIMEOUT) -> tuple[bool, str]:
    if not url:
        return False, "not_configured"
    try:
        req = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status < 500, f"http_{resp.status}"
        except urllib.error.HTTPError as e:
            # Any HTTP response means the service is reachable.
            return e.code < 500, f"http_{e.code}"
    except Exception as e:
        return False, str(e)


def _probe_kafka() -> tuple[bool, str]:
    if not KAFKA_BROKERS:
        return False, "not_configured"
    host, _, port = KAFKA_BROKERS.split(",")[0].partition(":")
    return _probe_tcp(host, int(port or "9092"))


def _probe_redis() -> tuple[bool, str]:
    if not REDIS_URL:
        return False, "not_configured"
    host, _, port = REDIS_URL.rsplit(":", 1)
    try:
        with socket.create_connection((host, int(port)), timeout=2.0) as s:
            s.sendall(b"PING\r\n")
            pong = s.recv(16)
            return pong.startswith(b"+PONG"), ""
    except Exception as e:
        return False, str(e)


def _probe_postgres() -> tuple[bool, str]:
    try:
        conn = _get_db_connection()
    except ScreeningUnavailable as e:
        return False, str(e)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return True, ""
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()


def build_health() -> dict:
    """Probe every dependency and report per-component status."""
    probes = {
        "kafka": _probe_kafka,
        "postgres": _probe_postgres,
        "redis": _probe_redis,
        # W12 B5-P1-F: real cluster reachability + health status (screening
        # decisions now depend on this cluster — see opensearch_screening.py).
        "opensearch": _os_screen.ping,
        "keycloak": lambda: _probe_http(KEYCLOAK_URL),
        "nibss_bvn": lambda: (
            (False, "not_configured") if not NIBSS_BVN_API_URL
            else _probe_http(NIBSS_BVN_API_URL)),
    }
    middleware = {}
    all_ok = True
    for name, probe in probes.items():
        try:
            ok, detail = probe()
        except Exception as e:
            ok, detail = False, str(e)
        middleware[name] = {"status": "connected" if ok else "unavailable"}
        if detail:
            middleware[name]["detail"] = detail
        if not ok:
            all_ok = False
    return middleware, all_ok


# ── HTTP Handler ──

# --- Canonical JWT validation (ported from services/shared/auth/jwt_validation.py; stdlib-only) ---
# RS256 via Keycloak JWKS (fetched with a 5s timeout + TTL cache) when KEYCLOAK_JWKS_URL
# is set; HS256 via JWT_SECRET otherwise; iss/aud checked when JWT_ISSUER / JWT_AUDIENCE
# are configured. Fail-closed: missing/malformed/expired/unknown-kid tokens are rejected;
# a JWKS outage with a cold cache yields "jwks_unavailable" (surfaced as HTTP 503).
import os as _jwt_os
import base64 as _jwt_b64
import hashlib as _jwt_hash
import hmac as _jwt_hmac
import json as _jwt_json
import time as _jwt_time
import urllib.request as _jwt_urlreq

_JWT_JWKS_URL = _jwt_os.environ.get("KEYCLOAK_JWKS_URL", "")
_JWT_SECRET = _jwt_os.environ.get("JWT_SECRET", "")
_JWT_ISSUER = _jwt_os.environ.get("JWT_ISSUER", "")
_JWT_AUDIENCE = _jwt_os.environ.get("JWT_AUDIENCE", "")
try:
    _JWT_JWKS_TTL = int(_jwt_os.environ.get("JWKS_CACHE_TTL_SECONDS", "300"))
except ValueError:
    _JWT_JWKS_TTL = 300
_jwks_cache = {"fetched_at": 0.0, "keys": {}}


def _jwt_b64url_decode(segment):
    segment += "=" * (-len(segment) % 4)
    return _jwt_b64.urlsafe_b64decode(segment.encode())


def _jwt_fetch_jwks():
    now = _jwt_time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWT_JWKS_TTL:
        return _jwks_cache["keys"], None
    try:
        with _jwt_urlreq.urlopen(_JWT_JWKS_URL, timeout=5) as resp:
            data = _jwt_json.loads(resp.read())
        keys = {k.get("kid"): k for k in data.get("keys", []) if k.get("kid")}
    except Exception:
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"], None  # stale cache: signatures are still really verified
        return None, "jwks_unavailable"
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys, None


def _jwt_verify_rs256(signing_input, signature, jwk):
    """Pure-stdlib RS256 (PKCS#1 v1.5 + SHA-256) verification against a JWK."""
    try:
        n = int.from_bytes(_jwt_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_jwt_b64url_decode(jwk["e"]), "big")
    except Exception:
        return False
    k = (n.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), e, n).to_bytes(k, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + _jwt_hash.sha256(signing_input).digest()
    if k < len(digest_info) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(digest_info) - 3) + b"\x00" + digest_info
    return _jwt_hmac.compare_digest(em, expected)


def _jwt_check_claims(payload):
    exp = payload.get("exp")
    if exp is None:
        return "Token missing exp claim"
    try:
        if _jwt_time.time() >= float(exp):
            return "Token expired"
    except (TypeError, ValueError):
        return "Invalid token expiry"
    if _JWT_ISSUER and payload.get("iss") != _JWT_ISSUER:
        return "Invalid token issuer"
    if _JWT_AUDIENCE:
        aud = payload.get("aud")
        if isinstance(aud, str):
            aud = [aud]
        if not isinstance(aud, list) or _JWT_AUDIENCE not in aud:
            return "Invalid token audience"
    return None


def validate_jwt(headers):
    """Validate a Bearer JWT from a headers mapping.

    Returns (claims, None) on success or (None, reason) on failure. Fails closed:
    any token that cannot be cryptographically verified is rejected, and when
    neither KEYCLOAK_JWKS_URL nor JWT_SECRET is configured the result is
    (None, "auth_not_configured").
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    try:
        header = _jwt_json.loads(_jwt_b64url_decode(parts[0]))
        payload = _jwt_json.loads(_jwt_b64url_decode(parts[1]))
        signature = _jwt_b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    alg = header.get("alg")
    signing_input = (parts[0] + "." + parts[1]).encode()
    if alg == "RS256":
        if not _JWT_JWKS_URL:
            return None, "auth_not_configured"
        keys, ferr = _jwt_fetch_jwks()
        if ferr:
            return None, ferr
        jwk = keys.get(header.get("kid"))
        if jwk is None:
            _jwks_cache["fetched_at"] = 0.0  # one forced refresh for an unknown kid
            keys, ferr = _jwt_fetch_jwks()
            if ferr:
                return None, ferr
            jwk = keys.get(header.get("kid"))
            if jwk is None:
                return None, "Unknown token key id"
        if not _jwt_verify_rs256(signing_input, signature, jwk):
            return None, "Invalid token signature"
    elif alg == "HS256":
        if not _JWT_SECRET or _JWT_SECRET.startswith("${"):
            return None, "auth_not_configured"
        expected = _jwt_hmac.new(_JWT_SECRET.encode(), signing_input, _jwt_hash.sha256).digest()
        if not _jwt_hmac.compare_digest(expected, signature):
            return None, "Invalid token signature"
    else:
        return None, "Unsupported token algorithm"
    err = _jwt_check_claims(payload)
    if err:
        return None, err
    return payload, None


class KYCAMLHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(body)

    def _respond(self, status: int, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        path = self.path.split("?")[0].rstrip("/")

        if path == "/healthz":
            middleware, all_ok = build_health()
            self._respond(200, {"status": "ok" if all_ok else "degraded",
                                "service": "kyc-aml-screening",
                                "middleware": middleware,
                                "port": os.environ.get("PORT", "8136")})
        elif path == "/v1/kyc/records":
            try:
                _items = KYC_STORE.all()
            except Exception as _e:
                self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
                return
            self._respond(200, {"items": _items, "total": len(_items)})
        elif path.startswith("/v1/kyc/records/"):
            cid = path.split("/")[-1]
            try:
                rec = KYC_STORE.get(cid) or _w12_get_by(KYC_STORE, "customer_id", cid)
            except Exception as _e:
                self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
                return
            if rec:
                self._respond(200, rec)
            else:
                self._respond(404, {"message": "KYC record not found"})
        elif path == "/v1/kyc/tiers":
            self._respond(200, KYC_TIER_LIMITS)
        elif path == "/v1/aml/screenings":
            try:
                _items = SCREENING_STORE.all()
            except Exception as _e:
                self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
                return
            self._respond(200, {"items": _items, "total": len(_items)})
        else:
            self._respond(404, {"message": "Not found"})

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        path = self.path.split("?")[0].rstrip("/")
        body = self._read_json()

        if path == "/v1/kyc/verify-bvn":
            self._verify_bvn(body)
        elif path == "/v1/kyc/records":
            self._create_kyc(body)
        elif path == "/v1/aml/screen":
            self._screen_customer(body)
        elif path == "/v1/aml/batch-screen":
            self._batch_screen(body)
        elif path == "/v1/kyc/upgrade-tier":
            self._upgrade_tier(body)
        elif path == "/v1/kyc/risk-score":
            self._compute_risk(body)
        elif path == "/v1/aml/opensearch/reindex":
            # W12 B5-P1-F: admin resync (JWT-protected — not probe-exempt).
            self._reindex_opensearch(body)
        else:
            self._respond(404, {"message": "Not found"})

    def _verify_bvn(self, body: dict):
        bvn = body.get("bvn", "")
        try:
            valid, message = verify_bvn(bvn)
        except BVNProviderUnavailable as e:
            self._respond(503, {"error": "bvn_provider_unavailable", "message": str(e)})
            return
        self._respond(200, {
            "bvn": bvn,
            "valid": valid,
            "message": message,
            "verifiedAt": now_iso() if valid else None,
        })

    def _create_kyc(self, body: dict):
        bvn = body.get("bvn", "")
        if not bvn:
            self._respond(400, {"message": "bvn is required"})
            return

        try:
            bvn_valid, bvn_msg = verify_bvn(bvn)
        except BVNProviderUnavailable as e:
            self._respond(503, {"error": "bvn_provider_unavailable", "message": str(e)})
            return

        # Insufficient identity data (no usable full name) means screening
        # CANNOT run — the record is "incomplete", never "clear".
        full_name = (body.get("fullName") or "").strip()
        screening_ran = bool(full_name)
        if screening_ran:
            try:
                matches, screening_status = screen_name(full_name)
            except ScreeningUnavailable as e:
                # Fail closed: cannot clear the customer, so do not create the record.
                self._respond(503, {"error": "sanctions_list_unavailable", "message": str(e)})
                return
            screening_notes = [m["matchedName"] + f" ({m['type']})" for m in matches]
        else:
            matches = []
            screening_status = ScreeningStatus.INCOMPLETE.value
            screening_notes = ["insufficient identity data (fullName missing) — screening not run; do not treat as clear"]

        risk_data = {"bvn_verified": bvn_valid, "pep_match": screening_status == "pep_match",
                     "sanctions_match": screening_status == "sanctions_match",
                     "id_verified": False, "address_verified": False}
        score, level = compute_risk_score(risk_data)

        if screening_status == "sanctions_match":
            self._respond(403, {"message": "Account creation blocked: sanctions match detected",
                                "matches": matches, "screeningStatus": screening_status})
            return

        rec = KYCRecord(
            id=gen_id("KYC"), customer_id=body.get("customerId", gen_id("CUST")),
            bvn=bvn, full_name=full_name,
            date_of_birth=body.get("dateOfBirth", ""), phone=body.get("phone", ""),
            email=body.get("email", ""), tier="tier1",
            bvn_verified=bvn_valid, bvn_verification_date=now_iso() if bvn_valid else None,
            id_type=None, id_number=None, id_verified=False,
            address=None, address_verified=False,
            risk_score=score, risk_level=level,
            screening_status=screening_status,
            screening_notes=screening_notes,
            # Only claim checks that actually ran.
            pep_check=screening_ran, sanctions_check=screening_ran,
            edd_required=level in ("high", "prohibited") or screening_status == "pep_match",
            last_screening_date=now_iso()[:10] if screening_ran else "",
            documents=[],
            created_at=now_iso(), updated_at=now_iso(),
        )
        try:
            KYC_STORE.put(rec.id, asdict(rec))
        except Exception as _e:
            self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
            return
        self._respond(201, asdict(rec))

    def _screen_customer(self, body: dict):
        name = (body.get("name") or "").strip()
        if not name:
            self._respond(400, {"message": "name is required"})
            return

        try:
            matches, status = screen_name(name)
        except ScreeningUnavailable as e:
            self._respond(503, {"error": "sanctions_list_unavailable", "message": str(e)})
            return
        score = 0
        if status == "sanctions_match":
            score = 100
        elif status == "pep_match":
            score = max(m.get("matchScore", 50) for m in matches) if matches else 50

        result = ScreeningResult(
            id=gen_id("SCR"), customer_id=body.get("customerId", ""),
            screening_type="name_screening", query_name=name,
            matches=matches, risk_score=int(score), status=status,
            notes=f"{len(matches)} match(es) found" if matches else "No matches",
            screened_at=now_iso(),
        )
        try:
            SCREENING_STORE.put(result.id, asdict(result))
        except Exception as _e:
            self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
            return
        self._respond(200, asdict(result))

    def _batch_screen(self, body: dict):
        names = body.get("names", [])
        if not names or not isinstance(names, list):
            self._respond(400, {"message": "names array is required"})
            return
        if len(names) > 100:
            self._respond(400, {"message": "Maximum 100 names per batch"})
            return

        try:
            load_watchlists()  # fail closed before screening any name
        except ScreeningUnavailable as e:
            self._respond(503, {"error": "sanctions_list_unavailable", "message": str(e)})
            return

        results = []
        for name in names:
            name = (name or "").strip() if isinstance(name, str) else ""
            if not name:
                # Never auto-clear an empty identity.
                results.append({"name": name, "status": ScreeningStatus.INCOMPLETE.value,
                                "matchCount": 0, "matches": []})
                continue
            matches, status = screen_name(name)
            results.append({"name": name, "status": status, "matchCount": len(matches),
                            "matches": matches})

        flagged = [r for r in results if r["status"] != "clear"]
        self._respond(200, {
            "totalScreened": len(results),
            "clearCount": len(results) - len(flagged),
            "flaggedCount": len(flagged),
            "results": results,
            "screenedAt": now_iso(),
        })

    def _upgrade_tier(self, body: dict):
        customer_id = body.get("customerId", "")
        try:
            _row = _w12_get_by(KYC_STORE, "customer_id", customer_id)
        except Exception as _e:
            self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
            return
        rec = KYCRecord(**_row) if _row else None
        if not rec:
            self._respond(404, {"message": "KYC record not found"})
            return

        id_type = body.get("idType")
        id_number = body.get("idNumber")
        address = body.get("address")

        if id_type and id_number:
            rec.id_type = id_type
            rec.id_number = id_number
            rec.id_verified = True
            rec.documents.append({"type": id_type, "status": "verified", "uploadedAt": now_iso()})
        if address:
            rec.address = address
            rec.address_verified = True
            rec.documents.append({"type": "address_proof", "status": "verified", "uploadedAt": now_iso()})

        old_tier = rec.tier
        rec.tier = determine_kyc_tier(rec)
        rec.updated_at = now_iso()
        limits = KYC_TIER_LIMITS[rec.tier]

        try:
            KYC_STORE.put(rec.id, asdict(rec))
        except Exception as _e:
            self._respond(503, {"error": "persistence_unavailable", "detail": str(_e)})
            return
        self._respond(200, {
            "customerId": customer_id,
            "previousTier": old_tier,
            "newTier": rec.tier,
            "upgraded": old_tier != rec.tier,
            "limits": limits,
            "record": asdict(rec),
        })

    def _compute_risk(self, body: dict):
        score, level = compute_risk_score(body)
        self._respond(200, {"riskScore": score, "riskLevel": level,
                            "eddRequired": level in ("high", "prohibited"),
                            "factors": body})

    def _reindex_opensearch(self, body: dict):
        """W12 B5-P1-F admin endpoint: force a full screening_watchlist ->
        OpenSearch resync (idempotent, natural _id). Fail closed: 503 when the
        source table or the cluster is unavailable."""
        try:
            result = sync_watchlist_indices(force=True)
        except ScreeningUnavailable as e:
            self._respond(503, {"error": "sanctions_list_unavailable", "message": str(e)})
            return
        self._respond(200, result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8136"))

    # W12 B5-P1-F: warm the OpenSearch screening indices in the background so
    # the first screening request doesn't pay bulk-index latency. Failure here
    # is NOT fatal: the screening path lazily re-syncs and fails closed (503)
    # if the cluster is genuinely unreachable.
    def _boot_opensearch_sync():
        try:
            result = sync_watchlist_indices()
            print(f"[kyc-aml] opensearch watchlist sync: {result}")
        except Exception as e:
            print(f"[kyc-aml] opensearch boot sync deferred: {e}")

    threading.Thread(target=_boot_opensearch_sync, daemon=True).start()

    server = HTTPServer(("0.0.0.0", port), KYCAMLHandler)
    print(f"KYC/AML Screening Service listening on :{port}")
    server.serve_forever()
