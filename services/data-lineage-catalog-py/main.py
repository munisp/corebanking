import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')
#!/usr/bin/env python3
"""Data lineage catalog — schema registry, data quality metrics, column-level lineage, impact analysis"""
import os, json, logging, uuid, re, time, hashlib, threading, collections
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("data-lineage-catalog-py")

PORT = int(os.environ.get("PORT", "8108"))
SERVICE_NAME = "data-lineage-catalog-py"
START_TIME = time.time()
_request_count = 0; _error_count = 0; _counter_lock = threading.Lock()

def mask_pii(value: str, field_type: str = "generic") -> str:
    if not value: return "***"
    if field_type in ("bvn", "nin"): return f"***{value[-4:]}" if len(value) >= 4 else "***"
    return "***"
def inc_requests():
    global _request_count
    with _counter_lock: _request_count += 1
def inc_errors():
    global _error_count
    with _counter_lock: _error_count += 1

_db = None
def get_db():
    global _db
    if _db is None:
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            try:
                import psycopg2; _db = psycopg2.connect(db_url); _db.autocommit = True
            except Exception as e: logger.error(f"DB failed: {e}")
    return _db
def db_insert(table, data):
    db = get_db()
    if not db: raise ConnectionError("database_unavailable")
    cur = db.cursor()
    cur.execute(f"INSERT INTO {table} (id, data, created_at) VALUES (%s, %s, NOW()) RETURNING id",
                (data.get("id", str(uuid.uuid4())), json.dumps(data)))
    return cur.fetchone()[0]
def validate_jwt(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "): return None, "missing_bearer_token"
    parts = auth[7:].split(".")
    if len(parts) != 3: return None, "invalid_jwt_format"
    try:
        import base64
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        if payload.get("exp", float("inf")) < time.time(): return None, "token_expired"
        return payload, None
    except Exception: return None, "jwt_decode_failed"

_rl_tokens = 100.0; _rl_last = time.time(); _rl_lock = threading.Lock()
def _rl_allow():
    global _rl_tokens, _rl_last
    with _rl_lock:
        now = time.time(); _rl_tokens = min(100.0, _rl_tokens + (now - _rl_last) * 10); _rl_last = now
        if _rl_tokens >= 1: _rl_tokens -= 1; return True
        return False

# ─── Schema Registry ───
_schemas = {}
_schema_lock = threading.Lock()

CORE_BANKING_SCHEMAS = {
    "accounts": {
        "columns": [
            {"name": "id", "type": "UUID", "nullable": False, "pii": False, "description": "Primary key"},
            {"name": "account_number", "type": "VARCHAR(10)", "nullable": False, "pii": True, "description": "NUBAN account number"},
            {"name": "bvn", "type": "VARCHAR(11)", "nullable": True, "pii": True, "description": "Bank Verification Number"},
            {"name": "customer_name", "type": "VARCHAR(200)", "nullable": False, "pii": True, "description": "Full name"},
            {"name": "account_type", "type": "VARCHAR(20)", "nullable": False, "pii": False, "description": "savings/current/fixed"},
            {"name": "tier", "type": "INTEGER", "nullable": False, "pii": False, "description": "CBN KYC tier (1-3)"},
            {"name": "balance_kobo", "type": "BIGINT", "nullable": False, "pii": True, "description": "Account balance in kobo"},
            {"name": "currency", "type": "VARCHAR(3)", "nullable": False, "pii": False, "description": "ISO 4217 currency code"},
            {"name": "status", "type": "VARCHAR(20)", "nullable": False, "pii": False, "description": "active/dormant/frozen/closed"},
            {"name": "created_at", "type": "TIMESTAMPTZ", "nullable": False, "pii": False, "description": "Account opening date"},
        ],
        "primary_key": "id",
        "indexes": ["account_number", "bvn", "customer_name", "status"],
        "partitioning": "RANGE(created_at) MONTHLY",
    },
    "transactions": {
        "columns": [
            {"name": "id", "type": "UUID", "nullable": False, "pii": False},
            {"name": "account_id", "type": "UUID", "nullable": False, "pii": False, "fk": "accounts.id"},
            {"name": "amount_kobo", "type": "BIGINT", "nullable": False, "pii": True},
            {"name": "direction", "type": "VARCHAR(6)", "nullable": False, "pii": False, "description": "credit/debit"},
            {"name": "channel", "type": "VARCHAR(20)", "nullable": False, "pii": False, "description": "NIP/USSD/POS/ATM/mobile/web"},
            {"name": "reference", "type": "VARCHAR(50)", "nullable": False, "pii": False},
            {"name": "narration", "type": "TEXT", "nullable": True, "pii": True},
            {"name": "status", "type": "VARCHAR(20)", "nullable": False, "pii": False},
            {"name": "created_at", "type": "TIMESTAMPTZ", "nullable": False, "pii": False},
        ],
        "primary_key": "id",
        "indexes": ["account_id", "reference", "channel", "created_at"],
        "partitioning": "RANGE(created_at) DAILY",
    },
    "kyc_records": {
        "columns": [
            {"name": "id", "type": "UUID", "nullable": False, "pii": False},
            {"name": "customer_id", "type": "UUID", "nullable": False, "pii": False, "fk": "accounts.id"},
            {"name": "bvn", "type": "VARCHAR(11)", "nullable": True, "pii": True},
            {"name": "nin", "type": "VARCHAR(11)", "nullable": True, "pii": True},
            {"name": "tier", "type": "INTEGER", "nullable": False, "pii": False},
            {"name": "verification_status", "type": "VARCHAR(20)", "nullable": False, "pii": False},
            {"name": "liveness_score", "type": "FLOAT", "nullable": True, "pii": False},
            {"name": "verified_at", "type": "TIMESTAMPTZ", "nullable": True, "pii": False},
        ],
        "primary_key": "id",
        "indexes": ["customer_id", "bvn", "nin", "verification_status"],
    },
    "aml_alerts": {
        "columns": [
            {"name": "id", "type": "UUID", "nullable": False, "pii": False},
            {"name": "account_id", "type": "UUID", "nullable": False, "pii": False, "fk": "accounts.id"},
            {"name": "alert_type", "type": "VARCHAR(50)", "nullable": False, "pii": False},
            {"name": "risk_score", "type": "FLOAT", "nullable": False, "pii": False},
            {"name": "status", "type": "VARCHAR(20)", "nullable": False, "pii": False},
            {"name": "filed_to_nfiu", "type": "BOOLEAN", "nullable": False, "pii": False},
            {"name": "created_at", "type": "TIMESTAMPTZ", "nullable": False, "pii": False},
        ],
        "primary_key": "id",
        "indexes": ["account_id", "alert_type", "status", "created_at"],
    },
}

# ─── Column-Level Lineage ───
LINEAGE_GRAPH = {
    "accounts.balance_kobo": {
        "upstream": ["transactions.amount_kobo"],
        "downstream": ["kyc_records.tier", "aml_alerts.risk_score"],
        "transformations": ["SUM(transactions.amount_kobo) WHERE direction='credit' - SUM WHERE direction='debit'"],
    },
    "transactions.amount_kobo": {
        "upstream": ["source: NIP/USSD/POS channel"],
        "downstream": ["accounts.balance_kobo", "aml_alerts.risk_score"],
        "transformations": ["raw_input validated against CBN tier limits"],
    },
    "kyc_records.tier": {
        "upstream": ["accounts.balance_kobo", "kyc_records.verification_status"],
        "downstream": ["accounts.tier"],
        "transformations": ["CBN tier assignment: Tier1 (<₦300K), Tier2 (<₦500K), Tier3 (unlimited)"],
    },
    "aml_alerts.risk_score": {
        "upstream": ["transactions.amount_kobo", "accounts.balance_kobo", "kyc_records.verification_status"],
        "downstream": ["NFIU STR filing"],
        "transformations": ["Multi-factor scoring: amount_z_score * 0.3 + velocity * 0.3 + pep_flag * 0.2 + geo_risk * 0.2"],
    },
}

# ─── Data Quality Rules ───
DATA_QUALITY_RULES = {
    "accounts": [
        {"rule": "not_null", "column": "account_number", "description": "Account number must not be null"},
        {"rule": "unique", "column": "account_number", "description": "Account number must be unique"},
        {"rule": "format", "column": "account_number", "pattern": r"^\d{10}$", "description": "NUBAN 10-digit format"},
        {"rule": "format", "column": "bvn", "pattern": r"^\d{11}$", "description": "BVN 11-digit format"},
        {"rule": "range", "column": "tier", "min": 1, "max": 3, "description": "CBN tier 1-3"},
        {"rule": "range", "column": "balance_kobo", "min": 0, "description": "Balance cannot be negative"},
        {"rule": "enum", "column": "status", "values": ["active", "dormant", "frozen", "closed"]},
        {"rule": "enum", "column": "currency", "values": ["NGN", "USD", "GBP", "EUR"]},
    ],
    "transactions": [
        {"rule": "not_null", "column": "amount_kobo"},
        {"rule": "range", "column": "amount_kobo", "min": 1, "description": "Amount must be positive"},
        {"rule": "foreign_key", "column": "account_id", "references": "accounts.id"},
        {"rule": "enum", "column": "direction", "values": ["credit", "debit"]},
        {"rule": "enum", "column": "channel", "values": ["NIP", "USSD", "POS", "ATM", "mobile", "web"]},
    ],
}

def evaluate_data_quality(table: str, sample_data: list) -> dict:
    """Run data quality rules against sample data."""
    rules = DATA_QUALITY_RULES.get(table, [])
    if not rules:
        return {"valid": False, "errors": [f"no_rules_for_table:{table}"]}

    results = []
    total_checks = 0
    passed_checks = 0

    for rule in rules:
        col = rule["column"]
        rule_type = rule["rule"]
        violations = []

        for i, row in enumerate(sample_data):
            value = row.get(col)
            total_checks += 1

            if rule_type == "not_null" and value is None:
                violations.append({"row": i, "value": value})
            elif rule_type == "format" and value is not None:
                if not re.match(rule["pattern"], str(value)):
                    violations.append({"row": i, "value": value})
            elif rule_type == "range":
                if value is not None:
                    if "min" in rule and value < rule["min"]:
                        violations.append({"row": i, "value": value})
                    if "max" in rule and value > rule["max"]:
                        violations.append({"row": i, "value": value})
            elif rule_type == "enum" and value is not None:
                if value not in rule.get("values", []):
                    violations.append({"row": i, "value": value})

            if not violations or violations[-1].get("row") != i:
                passed_checks += 1

        results.append({
            "rule": rule_type, "column": col,
            "description": rule.get("description", ""),
            "passed": len(violations) == 0,
            "violation_count": len(violations),
            "violations": violations[:5],
        })

    quality_score = passed_checks / total_checks * 100 if total_checks > 0 else 0
    return {
        "table": table,
        "rules_evaluated": len(rules),
        "quality_score": round(quality_score, 2),
        "results": results,
        "sample_size": len(sample_data),
        "ndpr_pii_columns": [c["name"] for s in CORE_BANKING_SCHEMAS.get(table, {}).get("columns", [])
                             for c in [s] if c.get("pii")],
    }

def impact_analysis(column: str) -> dict:
    """Analyze downstream impact of changes to a column."""
    if column not in LINEAGE_GRAPH:
        return {"valid": False, "errors": [f"column_not_in_lineage:{column}"]}

    lineage = LINEAGE_GRAPH[column]
    downstream = lineage.get("downstream", [])

    # Recursive impact
    all_impacted = set(downstream)
    queue = list(downstream)
    depth = 0
    while queue and depth < 5:
        next_queue = []
        for d in queue:
            if d in LINEAGE_GRAPH:
                children = LINEAGE_GRAPH[d].get("downstream", [])
                for c in children:
                    if c not in all_impacted:
                        all_impacted.add(c)
                        next_queue.append(c)
        queue = next_queue
        depth += 1

    return {
        "column": column,
        "upstream": lineage.get("upstream", []),
        "direct_downstream": downstream,
        "total_impacted": sorted(all_impacted),
        "impact_depth": depth,
        "transformations": lineage.get("transformations", []),
        "risk_level": "high" if len(all_impacted) > 3 else "medium" if len(all_impacted) > 1 else "low",
    }

def add_security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    def respond(self, code, data):
        if code >= 400: inc_errors()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        add_security_headers(self)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        inc_requests()
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        path = urlparse(self.path).path
        params = parse_qs(urlparse(self.path).query)
        if path == "/healthz":
            db = get_db()
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME,
                               "checks": {"database": "connected" if db else "not_configured"},
                               "schemas_registered": len(CORE_BANKING_SCHEMAS),
                               "lineage_columns": len(LINEAGE_GRAPH),
                               "uptime_secs": round(time.time() - START_TIME)})
        elif path == "/readyz": self.respond(200, {"ready": True})
        elif path == "/livez": self.respond(200, {"alive": True})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {_request_count}\n'.encode())
        elif path == "/v1/schemas":
            self.respond(200, {"schemas": {k: {"columns": len(v["columns"]), "indexes": v.get("indexes", [])}
                                            for k, v in CORE_BANKING_SCHEMAS.items()}})
        elif path.startswith("/v1/schemas/"):
            table = path.split("/")[-1]
            if table in CORE_BANKING_SCHEMAS:
                self.respond(200, CORE_BANKING_SCHEMAS[table])
            else:
                self.respond(404, {"error": f"schema_not_found:{table}"})
        elif path == "/v1/lineage":
            self.respond(200, {"lineage": {k: {"upstream": len(v["upstream"]), "downstream": len(v["downstream"])}
                                            for k, v in LINEAGE_GRAPH.items()}})
        elif path.startswith("/v1/lineage/"):
            column = path.split("/v1/lineage/")[1]
            self.respond(200, impact_analysis(column))
        elif path == "/v1/quality/rules":
            self.respond(200, {"rules": {k: len(v) for k, v in DATA_QUALITY_RULES.items()}})
        elif path == "/v1/pii-columns":
            pii = {}
            for table, schema in CORE_BANKING_SCHEMAS.items():
                pii[table] = [c["name"] for c in schema["columns"] if c.get("pii")]
            self.respond(200, {"pii_columns": pii, "ndpr_compliance": "columns_marked_for_masking"})
        else: self.respond(404, {"error": "not_found"})

    def do_POST(self):
        inc_requests()
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()) if int(self.headers.get("Content-Length", 0)) > 0 else {}
        except json.JSONDecodeError: self.respond(400, {"error": "invalid_json"}); return
        path = urlparse(self.path).path
        claims, err = validate_jwt(dict(self.headers))
        if err: self.respond(401, {"error": "unauthorized", "detail": err}); return
        if path == "/v1/quality/evaluate":
            self.respond(200, evaluate_data_quality(body.get("table", ""), body.get("sample_data", [])))
        elif path == "/v1/impact-analysis":
            self.respond(200, impact_analysis(body.get("column", "")))
        elif path == "/v1/create":
            try:
                body["id"] = f"LIN-{uuid.uuid4().hex[:12].upper()}"
                body["created_at"] = datetime.now(timezone.utc).isoformat()
                db_insert("lineage_entries", body)
                self.respond(201, {"created": True, "data": body})
            except ConnectionError: self.respond(503, {"error": "database_unavailable"})
            except Exception as e: logger.error(f"Write failed: {e}"); self.respond(500, {"error": "write_failed"})
        else: self.respond(404, {"error": "not_found"})



# ─── Idempotency Enforcement ────────────────────────────────────────────────
import hashlib as _idem_hashlib
_idempotency_cache = {}  # key -> (status_code, response_body, timestamp)

def check_idempotency(key: str) -> tuple:
    """Check if idempotency key has been seen. Returns (is_duplicate, cached_response)."""
    if key and key in _idempotency_cache:
        entry = _idempotency_cache[key]
        return True, entry
    return False, None

def store_idempotency(key: str, status_code: int, response: dict):
    """Store idempotency response for deduplication (24h TTL)."""
    import time
    if key:
        _idempotency_cache[key] = (status_code, response, time.time())
        # Cleanup entries older than 24h
        cutoff = time.time() - 86400
        for k in list(_idempotency_cache.keys()):
            if _idempotency_cache[k][2] < cutoff:
                del _idempotency_cache[k]


# ─── Maker-Checker (Dual Authorization) ─────────────────────────────────────
_maker_checker_requests = []
_MAKER_CHECKER_THRESHOLDS = {
    "transfer": 100_000_000,       # ₦1M
    "loan_disburse": 100_000_000,  # ₦1M
    "gl_posting": 50_000_000,      # ₦500K
    "account_close": 0,            # Always
}

def requires_maker_checker(operation: str, amount_kobo: int) -> bool:
    """Check if operation needs dual authorization per CBN guidelines."""
    threshold = _MAKER_CHECKER_THRESHOLDS.get(operation, 100_000_000)
    return amount_kobo >= threshold

def submit_for_approval(operation: str, maker_id: str, amount_kobo: int, payload: dict) -> dict:
    """Submit operation for maker-checker approval."""
    import time
    req = {
        "request_id": f"MCR-{int(time.time()*1000000)}",
        "operation": operation, "maker_id": maker_id, "amount_kobo": amount_kobo,
        "status": "pending_approval", "payload": payload,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _maker_checker_requests.append(req)
    return req


# ─── Immutable Audit Trail ───────────────────────────────────────────────────
import hashlib as _audit_hashlib
_audit_log = []  # Append-only. No deletion permitted.

def append_audit_entry(service: str, operation: str, actor_id: str, entity_id: str,
                       entity_type: str, old_state: str = "", new_state: str = "", ip: str = ""):
    """Append immutable audit entry with tamper-detection checksum."""
    import time
    entry_id = f"AUD-{int(time.time()*1000000)}"
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    raw = f"{entry_id}|{timestamp}|{service}|{operation}|{actor_id}|{entity_id}|{old_state}|{new_state}|{ip}"
    checksum = _audit_hashlib.sha256(raw.encode()).hexdigest()
    entry = {
        "id": entry_id, "timestamp": timestamp, "service": service,
        "operation": operation, "actor_id": actor_id, "entity_id": entity_id,
        "entity_type": entity_type, "old_state": old_state, "new_state": new_state,
        "ip_address": ip, "checksum": checksum, "immutable": True,
    }
    _audit_log.append(entry)
    # Persist to DB if available
    if _db_conn:
        try:
            _db_conn.cursor().execute(
                "INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (entry_id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip, checksum))
            _db_conn.commit()
        except Exception:
            pass
    return entry


# ─── Transaction Atomicity ───────────────────────────────────────────────────
def db_exec_atomic(queries_params: list) -> bool:
    """Execute multiple DB operations in a single atomic transaction.
    queries_params: [(sql, params_tuple), ...]
    Returns True on success, False on rollback.
    """
    if not _db_conn:
        return False
    cur = _db_conn.cursor()
    try:
        for sql, params in queries_params:
            cur.execute(sql, params)
        _db_conn.commit()
        return True
    except Exception as e:
        _db_conn.rollback()
        import logging
        logging.error(f"Atomic transaction failed, rolled back: {e}")
        return False

if __name__ == "__main__":
    get_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "Data lineage catalog started",
                            "schemas": list(CORE_BANKING_SCHEMAS.keys())}))
    server.serve_forever()
