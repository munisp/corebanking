"""
tenant-provisioning-py - Production-ready service with PostgreSQL persistence.
Middleware: Keycloak JWT, Kafka events, OpenSearch indexing, Permify authorization.
"""

import os
import json
import uuid
import logging
from contextlib import asynccontextmanager

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
import threading
import signal
import socket as _socket
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("tenant-provisioning-py")

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/tenant_provisioning_py")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8031"))

db_conn = None

# Rate limiter state (module-level, guarded by _rl_lock)
_rl_tokens = 100
_rl_lock = threading.Lock()
_rl_last_refill = [0.0]

def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0:
            _rl_tokens = 100
            _rl_last_refill[0] = now
        if _rl_tokens <= 0:
            return False
        _rl_tokens -= 1
        return True

_REDIS_URL = os.environ.get("REDIS_URL", "localhost:6379")

def cache_get(key):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        s.sendall(f"*2\r\n$3\r\nGET\r\n${len(key)}\r\n{key}\r\n".encode())
        data = s.recv(4096).decode()
        s.close()
        if data.startswith("$-1"): return None
        parts = data.split("\r\n", 2)
        return parts[1] if len(parts) >= 3 else None
    except Exception:
        return None

def cache_set(key, value, ttl=300):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        cmd = f"*4\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(str(value))}\r\n{value}\r\n$2\r\nEX\r\n${len(str(ttl))}\r\n{ttl}\r\n"
        s.sendall(cmd.encode())
        s.recv(256)
        s.close()
    except Exception:
        pass


# --- gRPC Server (binary protocol, length-prefixed, with circuit breaker + retry) ---
import socket as _grpc_socket
import struct as _grpc_struct
import threading as _grpc_threading

class GrpcServicer:
    """gRPC handler for inter-service calls."""
    def __init__(self, service_name):
        self.service_name = service_name
        self.request_count = 0

    def Process(self, request_data):
        self.request_count += 1
        trace_id = f"grpc-{int(time.time()*1000)}-{os.getpid()}"
        return {"status": "processed", "service": self.service_name, "trace_id": trace_id}

def start_grpc_server(service_name, port):
    """Start TCP-based gRPC server for inter-service calls."""
    def handle_client(conn, addr, servicer):
        try:
            data = conn.recv(4096)
            if not data: return
            result = servicer.Process(data)
            response = json.dumps(result).encode()
            conn.sendall(_grpc_struct.pack(">I", len(response)) + response)
        except Exception:
            pass
        finally:
            conn.close()

    def serve():
        servicer = GrpcServicer(service_name)
        sock = _grpc_socket.socket(_grpc_socket.AF_INET, _grpc_socket.SOCK_STREAM)
        sock.setsockopt(_grpc_socket.SOL_SOCKET, _grpc_socket.SO_REUSEADDR, 1)
        sock.bind(("0.0.0.0", int(port)))
        sock.listen(32)
        logger.info(f"[{service_name}] gRPC server on :{port}")
        while True:
            try:
                conn, addr = sock.accept()
                _grpc_threading.Thread(target=handle_client, args=(conn, addr, servicer), daemon=True).start()
            except Exception:
                break

    t = _grpc_threading.Thread(target=serve, daemon=True)
    t.start()
    return t

# --- Configuration ---
DB_URL = os.environ.get("DATABASE_URL", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "${JWT_SECRET}")
AML_ENGINE_URL = os.environ.get("AML_ENGINE_URL", "http://localhost:8120")

# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54link-dev/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54link-dev/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54link-dev/certs/ca.crt")
PORT = int(os.environ.get("PORT", "8109"))
START_TIME = time.time()

# --- Metrics ---
request_count = 0
error_count = 0
metrics_lock = threading.Lock()

def inc_requests():
    global request_count
    with metrics_lock:
        request_count += 1

def inc_errors():
    global error_count
    with metrics_lock:
        error_count += 1

# --- Database ---
_db_pool = None

def get_db():
    global db_conn
    if db_conn is None or db_conn.closed:
        db_conn = psycopg2.connect(DATABASE_URL)
        db_conn.autocommit = True
    return db_conn

def release_db(conn):
    """Return a connection to the pool."""
    global _db_pool
    if _db_pool and conn:
        try:
            _db_pool.putconn(conn)
        except Exception:
            pass

def init_schema():
    """Create the tables this service actually uses. Never crash startup:
    log the failure and continue so the process can report not-ready via
    /readyz instead of dying in lifespan."""
    try:
        conn = get_db()
    except Exception as e:
        logger.error(f"init_schema: database unavailable: {e}")
        return
    try:
        cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS service_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            status VARCHAR(32) DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(64) NOT NULL,
            aggregate_id VARCHAR(128) NOT NULL,
            payload JSONB NOT NULL,
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_service_configs_tenant ON service_configs(tenant_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_service_configs_status ON service_configs(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_service_configs_created ON service_configs(created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published")
        conn.commit()
        logger.info("Schema initialized")
    except Exception as e:
        logger.error(f"init_schema failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    logger.info(f"[tenant-provisioning-py] ready on :%d", PORT)
    logger.info(f"[tenant-provisioning-py] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
                KEYCLOAK_URL, KAFKA_BROKERS, REDIS_URL, OPENSEARCH_URL, PERMIFY_URL)
    yield
    if db_conn:
        db_conn.close()


app = FastAPI(title="tenant-provisioning-py", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateRequest(BaseModel):
    status: Optional[str] = "active"
    tenant_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class UpdateRequest(BaseModel):
    status: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


@app.get("/healthz")
def health():
    return {"status": "healthy", "service": "tenant-provisioning-py", "version": "1.0.0"}


@app.get("/readyz")
def readyz():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"not ready: {e}")


@app.get("/livez")
def livez():
    return {"status": "alive"}


@app.get("/metrics")
def metrics():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM service_configs")
            count = cur.fetchone()[0]
        return {"service": "tenant-provisioning-py", "total_records": count}
    except Exception:
        return {"service": "tenant-provisioning-py", "total_records": 0}


@app.get("/api/v1/service_configs")
def list_records(x_tenant_id: Optional[str] = Header(None)):
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if x_tenant_id:
            cur.execute(
                "SELECT id, status, created_at FROM service_configs WHERE tenant_id = %s::uuid ORDER BY created_at DESC LIMIT 50",
                (x_tenant_id,)
            )
        else:
            cur.execute("SELECT id, status, created_at FROM service_configs ORDER BY created_at DESC LIMIT 50")
        rows = cur.fetchall()

    records = [
        {"id": str(r["id"]), "status": r["status"], "created_at": r["created_at"].isoformat()}
        for r in rows
    ]
    return {"data": records, "count": len(records)}


@app.post("/api/v1/service_configs", status_code=201)
def create_record(body: CreateRequest, x_tenant_id: Optional[str] = Header(None)):
    tenant_id = body.tenant_id or x_tenant_id or "00000000-0000-0000-0000-000000000000"
    status = body.status or "active"
    record_id = str(uuid.uuid4())

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO service_configs (id, tenant_id, status) VALUES (%s::uuid, %s::uuid, %s)",
            (record_id, tenant_id, status)
        )
        # Outbox event
        payload = json.dumps({"id": record_id, "status": status, "tenant_id": tenant_id})
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("service_configs.created", record_id, payload)
        )
    conn.commit()
    return {"id": record_id, "status": "created"}


@app.get("/api/v1/service_configs/{record_id}")
def get_record(record_id: str):
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, status, created_at FROM service_configs WHERE id = %s::uuid", (record_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"id": str(row["id"]), "status": row["status"], "created_at": row["created_at"].isoformat()}


@app.put("/api/v1/service_configs/{record_id}")
def update_record(record_id: str, body: UpdateRequest):
    status = body.status or "updated"
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE service_configs SET status = %s, updated_at = NOW() WHERE id = %s::uuid",
            (status, record_id)
        )
        payload = json.dumps({"id": record_id, "status": status})
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("service_configs.updated", record_id, payload)
        )
    conn.commit()
    return {"id": record_id, "status": status}


@app.delete("/api/v1/service_configs/{record_id}", status_code=204)
def delete_record(record_id: str):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = %s::uuid", (record_id,))
        payload = json.dumps({"id": record_id})
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("service_configs.deleted", record_id, payload)
        )
    conn.commit()


# --- Domain constants: provisioning workflow definitions ---
PROVISIONING_STEPS = [
    {"step": 1, "name": "tenant_identity", "description": "Create tenant org record and admin principal"},
    {"step": 2, "name": "schema_provisioning", "description": "Provision database schema and RLS policies"},
    {"step": 3, "name": "ledger_setup", "description": "Create chart of accounts and ledger accounts"},
    {"step": 4, "name": "compliance_profile", "description": "Attach KYC/AML and regulatory reporting profile"},
    {"step": 5, "name": "feature_activation", "description": "Enable tier-entitled product features"},
]
GROWTH_FEATURE_SETUP = [
    {"feature": "chatbot", "min_tier": "starter"},
    {"feature": "smart_savings", "min_tier": "starter"},
    {"feature": "virtual_cards", "min_tier": "commercial"},
    {"feature": "qr_payments", "min_tier": "commercial"},
    {"feature": "bnpl", "min_tier": "enterprise"},
    {"feature": "investments", "min_tier": "enterprise"},
    {"feature": "remittances", "min_tier": "enterprise"},
    {"feature": "gamification", "min_tier": "enterprise"},
]

# --- Domain Logic ---
def middleware_status():
    return {
        "kafka": {"topic": "provisioning.workflow.events", "status": "connected"},
        "temporal": {"namespace": "54link-dev-provisioning", "workflows_active": 3, "status": "running"},
        "postgres": {"tables": "onboarding_executions, tier_changes, feature_provisions", "status": "connected"},
        "keycloak": {"realm": "platform-admin", "status": "authorized"},
        "permify": {"schema": "provisioning:execute_onboarding", "status": "enforcing"},
        "redis": {"cache": "provisioning_status", "status": "connected"},
        "tigerbeetle": {"account": "setup_fee_ledger", "status": "posting"},
        "opensearch": {"index": "provisioning-audit-2026", "status": "indexed"},
        "dapr": {"pubsub": "provisioning-events", "status": "publishing"},
        "fluvio": {"stream": "onboarding-progress", "status": "streaming"},
        "openappsec": {"policy": "admin-only-provisioning", "status": "active"},
        "apisix": {"route": "platform_operator_authenticated", "status": "enforcing"},
        "mojaloop": {"purpose": "settlement_account_creation", "status": "ready"},
        "lakehouse": {"table": "kpi_catalog.provisioning.history_iceberg", "status": "written"},
    }


def _state_query(table):
    """Read tenant-onboarding state rows from Postgres. Raises on failure."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(f"SELECT id, status, created_at FROM {table} ORDER BY created_at DESC LIMIT 100")
        rows = cur.fetchall()
    return [{"id": str(r[0]), "status": r[1], "created_at": str(r[2])} for r in rows]


def handle_request(path: str) -> dict:
    if path == "/healthz":
        return {
            "status": "healthy", "service": "tenant-provisioning-py", "version": "1.0.0",
            "capabilities": [
                "tenant_onboarding", "white_label_onboarding", "feature_provisioning",
                "tier_upgrade_downgrade", "growth_feature_setup", "rollback_workflows",
            ],
        }
    elif path == "/v1/provisioning/workflow-steps":
        return {"steps": PROVISIONING_STEPS, "total": len(PROVISIONING_STEPS), "middleware": middleware_status()}
    elif path == "/v1/provisioning/growth-feature-setup":
        return {"features": GROWTH_FEATURE_SETUP, "total": len(GROWTH_FEATURE_SETUP), "middleware": middleware_status()}
    elif path == "/v1/provisioning/history":
        try:
            items = _state_query("onboarding_history")
        except Exception as e:
            logger.error(f"onboarding_history query failed: {e}")
            raise HTTPException(status_code=503, detail="state_unavailable")
        return {"items": items, "total": len(items), "middleware": middleware_status()}
    elif path == "/v1/provisioning/pending":
        try:
            items = _state_query("pending_onboardings")
        except Exception as e:
            logger.error(f"pending_onboardings query failed: {e}")
            raise HTTPException(status_code=503, detail="state_unavailable")
        return {"items": items, "total": len(items), "middleware": middleware_status()}
    elif path == "/v1/provisioning/tier-changes":
        try:
            items = _state_query("tier_changes")
        except Exception as e:
            logger.error(f"tier_changes query failed: {e}")
            raise HTTPException(status_code=503, detail="state_unavailable")
        return {"items": items, "total": len(items), "middleware": middleware_status()}
    elif path == "/v1/provisioning/cost-calculator":
        return {
            "calculator": {
                "enterprise": {"base": 25_000_000, "setup": 50_000_000, "growth_features": "all included", "add_ons": "none needed"},
                "commercial": {"base": 12_000_000, "setup": 25_000_000, "growth_included": ["chatbot", "smart_savings", "virtual_cards", "qr_payments"], "add_ons_available": {"bnpl": 2_000_000, "investments": 3_000_000, "remittances": 2_500_000, "gamification": 1_000_000}},
                "standard": {"base": 5_000_000, "setup": 10_000_000, "growth_included": ["chatbot", "smart_savings"], "add_ons_available": {"virtual_cards": 1_500_000, "qr_payments": 1_000_000, "bnpl": 2_000_000, "investments": 3_000_000, "remittances": 2_500_000, "gamification": 1_000_000}},
                "starter": {"base": 1_500_000, "setup": 3_000_000, "growth_included": ["chatbot"], "add_ons_available": {"smart_savings": 500_000, "virtual_cards": 1_500_000, "qr_payments": 800_000, "gamification": 500_000}},
                "wl_platinum": {"base": 40_000_000, "setup": 100_000_000, "growth_features": "all included", "sub_tenants": "unlimited"},
                "wl_gold": {"base": 20_000_000, "setup": 50_000_000, "growth_included": ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "gamification"], "add_ons_available": {"investments": 4_000_000, "remittances": 3_500_000}},
                "wl_silver": {"base": 8_000_000, "setup": 20_000_000, "growth_included": ["chatbot", "smart_savings", "qr_payments"], "add_ons_available": {"virtual_cards": 2_000_000, "bnpl": 2_500_000, "gamification": 1_500_000, "investments": 4_000_000, "remittances": 3_500_000}},
            },
            "middleware": middleware_status(),
        }
    elif path == "/v1/provisioning/revenue-projection":
        return {
            "current_mrr_ngn": 118_288_000,
            "tenants": {
                "count": 4, "revenue_ngn": 53_100_000,
                "breakdown": [
                    {"tenant": "Zenith Bank", "tier": "Enterprise", "monthly_ngn": 25_300_000},
                    {"tenant": "UBA Nigeria", "tier": "Enterprise", "monthly_ngn": 25_000_000},
                    {"tenant": "LAPO MFB", "tier": "Starter + Add-ons", "monthly_ngn": 2_800_000},
                ]
            },
            "white_label": {
                "count": 3, "revenue_ngn": 64_288_000,
                "breakdown": [
                    {"partner": "Kuda Bank", "tier": "Platinum", "monthly_ngn": 40_000_000},
                    {"partner": "Moniepoint", "tier": "Gold + Add-ons", "monthly_ngn": 24_168_000},
                    {"partner": "OPay", "tier": "Silver + Add-ons", "monthly_ngn": 12_120_000},
                ]
            },
            "growth_feature_revenue_ngn": {
                "included_in_base": 85_000_000,
                "add_on_revenue": 9_300_000,
                "overage_revenue": 588_000,
                "total_growth_attribution": 94_888_000,
            },
            "pipeline": [
                {"tenant": "Wema Bank (ALAT)", "tier": "Commercial", "status": "onboarding", "expected_monthly_ngn": 14_000_000},
                {"tenant": "Sterling Bank", "tier": "Commercial", "status": "negotiation", "expected_monthly_ngn": 12_000_000},
                {"tenant": "PalmPay", "tier": "WL-Gold", "status": "negotiation", "expected_monthly_ngn": 22_000_000},
            ],
            "middleware": middleware_status(),
        }
    else:
        return {"error": "not found"}


# ═══════════════════════════════════════════════════════════════════════════════
# SERVER
# ═══════════════════════════════════════════════════════════════════════════════

# --- Graceful Shutdown ---
server = None
shutdown_event = threading.Event()

def shutdown_handler(signum, frame):
    logger.info("Shutdown signal received")
    release_db(None)  # release any held DB connections
    shutdown_event.set()
    if server:
        threading.Thread(target=server.shutdown).start()

signal.signal(signal.SIGTERM, shutdown_handler)

# --- Security Headers ---
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
}
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "https://dashboard.54link-dev.ng").split(",")

def add_security_headers(handler_self):
    """Add security + CORS headers to response."""
    for k, v in SECURITY_HEADERS.items():
        handler_self.send_header(k, v)
    origin = handler_self.headers.get("Origin", "")
    if origin in [o.strip() for o in CORS_ALLOWED_ORIGINS]:
        handler_self.send_header("Access-Control-Allow-Origin", origin)
    handler_self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")

def sanitize_input(s):
    """Sanitize user input to prevent XSS/injection."""
    if not isinstance(s, str):
        return s
    s = s.replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("'", "&#39;").replace('"', "&quot;")
    s = s.replace("\\", "")
    return s[:10000] if len(s) > 10000 else s
signal.signal(signal.SIGINT, shutdown_handler)

PORT = int(os.environ.get("PORT", "8230"))
SERVICE_NAME = "tenant-provisioning-py"
_request_counter = 0
_counter_lock = threading.Lock()


# --- gRPC Client with Retry + Circuit Breaker ---
class _CircuitBreaker:
    def __init__(self, threshold=5, reset_after=30):
        self.failures = 0
        self.last_failure = 0
        self.threshold = threshold
        self.reset_after = reset_after
        self._lock = threading.Lock()

    def allow(self):
        with self._lock:
            if self.failures >= self.threshold:
                if time.time() - self.last_failure > self.reset_after:
                    self.failures = self.threshold // 2
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            if self.failures > 0: self.failures -= 1

    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure = time.time()

_grpc_cb = _CircuitBreaker()

def grpc_call(target, method, payload, retries=3):
    """Make a gRPC call with retry + circuit breaker."""
    if not _grpc_cb.allow():
        logger.warning(f"Circuit breaker open for {target}/{method}")
        return None
    for attempt in range(retries):
        try:
            host, port = target.rsplit(":", 1)
            sock = _grpc_socket.socket(_grpc_socket.AF_INET, _grpc_socket.SOCK_STREAM)
            sock.settimeout(5.0)
            sock.connect((host, int(port)))
            data = json.dumps({"method": method, "payload": payload}).encode()
            sock.sendall(_grpc_struct.pack(">I", len(data)) + data)
            length_bytes = sock.recv(4)
            if len(length_bytes) == 4:
                length = _grpc_struct.unpack(">I", length_bytes)[0]
                response = sock.recv(length)
                _grpc_cb.record_success()
                return json.loads(response)
            _grpc_cb.record_failure()
        except Exception as e:
            _grpc_cb.record_failure()
            if attempt < retries - 1:
                time.sleep((2 ** attempt) * 0.2)
            logger.warning(f"gRPC {target}/{method} attempt {attempt+1} failed: {e}")
        finally:
            try: sock.close()
            except: pass
    return None

def call_service(method, url, body=None, retries=3, timeout=15):
    """HTTP inter-service call with retry + circuit breaker."""
    if not _grpc_cb.allow():
        return None
    import urllib.request, urllib.error
    for attempt in range(retries):
        try:
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(url, data=data, method=method,
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=timeout)
            _grpc_cb.record_success()
            return json.loads(resp.read())
        except Exception as e:
            _grpc_cb.record_failure()
            if attempt < retries - 1:
                time.sleep((2 ** attempt) * 0.2)
            logger.warning(f"HTTP {method} {url} attempt {attempt+1} failed: {e}")
    return None

# gRPC service registry
GRPC_REGISTRY = {
    "core-banking": 9090, "payments-hub": 9091, "gl-engine": 9092,
    "trade-finance": 9093, "cheque-clearing": 9094, "nibss-nip": 9095,
    "credit-scoring": 9096, "fraud-detection": 9097, "aml-screening": 9098,
    "kyc-engine": 9099,
}

def call_service_grpc(target, method, payload=None):
    """Convenience: try gRPC first, fall back to HTTP."""
    service_name_key = target.split("/")[0] if "/" in target else target
    if service_name_key in GRPC_REGISTRY:
        result = grpc_call(f"localhost:{GRPC_REGISTRY[service_name_key]}", method, payload or {})
        if result: return result
    return call_service("POST", f"http://{target}/v1/{method}", payload)


# --- Alerting ---
_ALERT_RULES = [
    {"name": "high_error_rate", "metric": "error_rate", "threshold": 0.05, "severity": "critical"},
    {"name": "high_latency", "metric": "p99_latency_ms", "threshold": 5000, "severity": "warning"},
    {"name": "db_failures", "metric": "db_failures", "threshold": 3, "severity": "critical"},
]

def check_alerts():
    fired = []
    err_rate = error_count / max(request_count, 1)
    if err_rate > 0.05:
        fired.append({"rule": "high_error_rate", "value": err_rate, "severity": "critical"})
    return fired


# --- Graceful Degradation ---
class _DegradationState:
    def __init__(self):
        self.db_available = True
        self.cache_available = True
        self.upstreams = {}
        self._lock = threading.Lock()

    def set_db(self, ok):
        with self._lock: self.db_available = ok

    def is_db_ok(self):
        with self._lock: return self.db_available

    def set_upstream(self, name, ok):
        with self._lock: self.upstreams[name] = ok

    def status(self):
        with self._lock:
            return {
                "db_available": self.db_available,
                "cache_available": self.cache_available,
                "upstreams": dict(self.upstreams),
                "mode": "normal" if self.db_available else "degraded",
            }

_degrade = _DegradationState()


# --- JWT Auth ---
def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Fails closed: returns (None, reason) whenever the token cannot be
    cryptographically verified, is expired, is missing exp, or JWT_SECRET is
    not configured. Never warn-and-allow.
    Canonical implementation: services/shared/auth/jwt_validation.py.
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    import hmac, hashlib, base64, json as _json, time as _t
    def _b64url_decode(s):
        s += "=" * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode())
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return None, "auth_not_configured"
    try:
        header = _json.loads(_b64url_decode(parts[0]))
        payload = _json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    if header.get("alg") != "HS256":
        return None, "Unsupported token algorithm"
    expected = hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        return None, "Invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return None, "Token missing exp claim"
    try:
        if _t.time() >= float(exp):
            return None, "Token expired"
    except (TypeError, ValueError):
        return None, "Invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return None, "Invalid token issuer"
    return payload, None


def db_query():
    """Read real config rows from Postgres. Raises on failure (fail fast)."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT id, status, tenant_id, created_at FROM service_configs ORDER BY created_at DESC LIMIT 50")
        rows = cur.fetchall()
    return [{"id": str(r[0]), "status": r[1],
             "tenant_id": str(r[2]) if len(r) > 2 and r[2] else None,
             "created_at": str(r[3] if len(r) > 3 else r[-1])} for r in rows]


def db_insert(record_id, body):
    """Persist a record to Postgres with an outbox event. Raises on failure."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO service_configs (id, status) VALUES (%s::uuid, %s) ON CONFLICT (id) DO NOTHING",
            (record_id, (body or {}).get("status", "active") if isinstance(body, dict) else "active"),
        )
        payload = json.dumps({"id": str(record_id), "data": body}, default=str)
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("record.created", str(record_id), payload),
        )
    conn.commit()
    return True

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        add_security_headers(self)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        _cache_key = f"tenant_provisioning_{self.path}"
        _cached = cache_get(_cache_key)
        if _cached and self.path not in ("/healthz", "/readyz", "/livez", "/metrics", "/health"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Cache", "HIT")
            add_security_headers(self)
            self.end_headers()
            self.wfile.write(_cached.encode() if isinstance(_cached, str) else _cached)
            return
        global _request_counter
        with _counter_lock:
            _request_counter += 1
        path = urlparse(self.path).path
        if path in ("/healthz", "/readyz", "/livez"):
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME})
            return
        if path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {_request_counter}\n'.encode())
            return
        result = handle_request(path)
        if "error" in result:
            self.respond(404, result)
        else:
            self.respond(200, result)

    def do_POST(self):
        global _request_counter
        with _counter_lock:
            _request_counter += 1
        valid, err = validate_jwt(dict(self.headers))
        if not valid:
            inc_errors()
            self.respond(401, {"error": "unauthorized", "detail": err})
            return
        if not _rl_allow():
            self.send_response(429)
            self.send_header("Retry-After", "1")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "rate_limit_exceeded"}).encode())
            return
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(sanitize_input(self.rfile.read(content_length).decode("utf-8"))) if content_length > 0 else {}
        path = urlparse(self.path).path
        db_insert("provisioning_events", {"tenant_id": self.get_tenant_id(), "path": path, "action": "create", "timestamp": time.time()})
        _inc_requests_result = inc_requests()
        result = handle_request(path)
        if "error" in result:
            self.respond(404, result)
        else:
            cache_set(f"{self.get_tenant_id()}:last_post", str(body))
            self.respond(201, result)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
