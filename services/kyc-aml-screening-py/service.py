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
import os, uuid, json, re, csv, io, socket, difflib
import urllib.request, urllib.error
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
import os
import json
import re


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
OPENSEARCH_URL = os.environ.get("OPENSEARCH_ENDPOINT", "")
KEYCLOAK_URL = os.environ.get("KEYCLOAK_REALM_URL", "")
APP_ENV = os.environ.get("APP_ENV", "production").lower()
WATCHLIST_AUTO_SEED = os.environ.get("WATCHLIST_AUTO_SEED", "").lower() == "true"
WATCHLIST_CACHE_TTL_SECONDS = int(os.environ.get("WATCHLIST_CACHE_TTL_SECONDS", "300"))
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


# ── State ──

kyc_records: list[KYCRecord] = []
screening_results: list[ScreeningResult] = []


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
    """
    pep_list, sanctions_list = load_watchlists()
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
    kyc_records.extend([
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
    ])

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
        "opensearch": lambda: _probe_http(OPENSEARCH_URL),
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
        path = self.path.split("?")[0].rstrip("/")

        if path == "/healthz":
            middleware, all_ok = build_health()
            self._respond(200, {"status": "ok" if all_ok else "degraded",
                                "service": "kyc-aml-screening",
                                "middleware": middleware,
                                "port": os.environ.get("PORT", "8136")})
        elif path == "/v1/kyc/records":
            self._respond(200, {"items": [asdict(r) for r in kyc_records], "total": len(kyc_records)})
        elif path.startswith("/v1/kyc/records/"):
            cid = path.split("/")[-1]
            rec = next((r for r in kyc_records if r.id == cid or r.customer_id == cid), None)
            if rec:
                self._respond(200, asdict(rec))
            else:
                self._respond(404, {"message": "KYC record not found"})
        elif path == "/v1/kyc/tiers":
            self._respond(200, KYC_TIER_LIMITS)
        elif path == "/v1/aml/screenings":
            self._respond(200, {"items": [asdict(r) for r in screening_results], "total": len(screening_results)})
        else:
            self._respond(404, {"message": "Not found"})

    def do_POST(self):
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
        kyc_records.append(rec)
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
        screening_results.append(result)
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
        rec = next((r for r in kyc_records if r.customer_id == customer_id), None)
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8136"))
    server = HTTPServer(("0.0.0.0", port), KYCAMLHandler)
    print(f"KYC/AML Screening Service listening on :{port}")
    server.serve_forever()
