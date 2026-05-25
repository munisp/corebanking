"""
tenant-management-py — 54Bank Multi-Tenant Management Service

Handles tenant lifecycle, tier/plan provisioning, white-label configuration,
and data isolation enforcement. The platform owner uses this service to
create tenants, assign plans, and configure white-label branding.

Tier Definitions:
  - starter:      Core banking, GL, 2 agents (NL-reporting, reconciliation)
  - professional:  + 5 more agents, KPI dashboards (CFO/COO/CTO), graph tools
  - enterprise:    All 10 agents, all 8 KPI roles, full graph + AI, white-label, custom domain
  - white_label:   Enterprise + full UI rebranding, sub-tenant provisioning

Data Isolation:
  Every DB query, KPI lookup, agent call, and cache key is scoped by tenant_id.
  JWT tokens carry tenant_id claim. Gateway injects X-Tenant-Id header.
"""
import os, sys, json, time, signal, threading, uuid, re, html
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

SERVICE_NAME = "tenant-management-py"
PORT = int(os.environ.get("PORT", "8080"))

# --- Logging ---
import logging
class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "service": SERVICE_NAME, "message": record.getMessage()})
_handler = logging.StreamHandler(); _handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(SERVICE_NAME)

# --- Rate Limiting ---
_rl_tokens = 100; _rl_lock = threading.Lock(); _rl_last = [0.0]
def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last[0] >= 1.0: _rl_tokens = 100; _rl_last[0] = now
        if _rl_tokens <= 0: return False
        _rl_tokens -= 1; return True

# --- Metrics ---
request_count = 0; error_count = 0; _m_lock = threading.Lock()
def inc_requests():
    global request_count
    with _m_lock: request_count += 1
def inc_errors():
    global error_count
    with _m_lock: error_count += 1

# --- Tier Feature Matrix ---
TIER_FEATURES = {
    "starter": {
        "max_users": 50,
        "agents": ["nl-reporting", "reconciliation"],
        "kpi_roles": ["cfo", "coo"],
        "graph_tools": [],
        "white_label": False,
        "custom_domain": False,
        "api_rate_limit": 100,
        "data_retention_days": 90,
        "support_level": "email",
        "max_branches": 5,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports"],
    },
    "professional": {
        "max_users": 500,
        "agents": ["nl-reporting", "reconciliation", "account-opening", "loan-origination",
                    "cash-management", "customer-360", "regulatory-returns"],
        "kpi_roles": ["cfo", "coo", "cto", "compliance"],
        "graph_tools": ["coa-graph", "pagerank"],
        "white_label": False,
        "custom_domain": False,
        "api_rate_limit": 500,
        "data_retention_days": 365,
        "support_level": "priority",
        "max_branches": 50,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports",
                      "advanced-reports", "trade-finance", "fx-trading"],
    },
    "enterprise": {
        "max_users": -1,
        "agents": ["nl-reporting", "reconciliation", "account-opening", "loan-origination",
                    "cash-management", "customer-360", "regulatory-returns",
                    "transaction-investigation", "fraud-detection", "dormancy-prevention"],
        "kpi_roles": ["board", "cfo", "cro", "coo", "cto", "compliance", "rm", "branch"],
        "graph_tools": ["coa-graph", "pagerank", "basel-iii", "liquidity", "semantic-search"],
        "white_label": False,
        "custom_domain": True,
        "api_rate_limit": 2000,
        "data_retention_days": -1,
        "support_level": "dedicated",
        "max_branches": -1,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports",
                      "advanced-reports", "trade-finance", "fx-trading",
                      "islamic-banking", "agency-banking", "microfinance"],
    },
    "white_label": {
        "max_users": -1,
        "agents": ["nl-reporting", "reconciliation", "account-opening", "loan-origination",
                    "cash-management", "customer-360", "regulatory-returns",
                    "transaction-investigation", "fraud-detection", "dormancy-prevention"],
        "kpi_roles": ["board", "cfo", "cro", "coo", "cto", "compliance", "rm", "branch"],
        "graph_tools": ["coa-graph", "pagerank", "basel-iii", "liquidity", "semantic-search"],
        "white_label": True,
        "custom_domain": True,
        "api_rate_limit": 5000,
        "data_retention_days": -1,
        "support_level": "white-glove",
        "max_branches": -1,
        "sub_tenant_provisioning": True,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports",
                      "advanced-reports", "trade-finance", "fx-trading",
                      "islamic-banking", "agency-banking", "microfinance",
                      "custom-branding", "sub-tenant-management"],
    },
}

# --- In-Memory Tenant Store (production: Postgres) ---
_tenants = {}
_tenant_lock = threading.Lock()

def _init_platform_tenant():
    """Create the platform owner tenant on startup."""
    platform = {
        "id": "platform",
        "name": "54Bank Platform",
        "slug": "54bank",
        "tier": "white_label",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "owner_email": "admin@54bank.ng",
        "branding": {
            "logo_url": "/assets/54bank-logo.png",
            "primary_color": "#1a237e",
            "secondary_color": "#0d47a1",
            "accent_color": "#ff6f00",
            "app_name": "54Bank",
            "favicon_url": "/assets/favicon.ico",
            "custom_css": "",
        },
        "config": {
            "default_currency": "NGN",
            "timezone": "Africa/Lagos",
            "locale": "en-NG",
            "mfa_required": True,
            "ip_whitelist": [],
            "webhook_url": "",
        },
        "usage": {
            "active_users": 0,
            "total_transactions": 0,
            "storage_mb": 0,
            "api_calls_today": 0,
        },
        "sub_tenants": [],
    }
    with _tenant_lock:
        _tenants["platform"] = platform
    # Create a demo tenant
    demo = {
        "id": str(uuid.uuid4()),
        "name": "Demo MFB",
        "slug": "demo-mfb",
        "tier": "professional",
        "status": "active",
        "parent_tenant_id": "platform",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "owner_email": "admin@demo-mfb.ng",
        "branding": {
            "logo_url": "",
            "primary_color": "#2e7d32",
            "secondary_color": "#1b5e20",
            "accent_color": "#ff8f00",
            "app_name": "Demo MFB",
            "favicon_url": "",
            "custom_css": "",
        },
        "config": {
            "default_currency": "NGN",
            "timezone": "Africa/Lagos",
            "locale": "en-NG",
            "mfa_required": False,
            "ip_whitelist": [],
            "webhook_url": "",
        },
        "usage": {
            "active_users": 34,
            "total_transactions": 12847,
            "storage_mb": 256,
            "api_calls_today": 4521,
        },
        "sub_tenants": [],
    }
    with _tenant_lock:
        _tenants[demo["id"]] = demo
        _tenants["platform"]["sub_tenants"].append(demo["id"])

_init_platform_tenant()

# --- DB Persistence (stub — production uses Postgres) ---
def db_insert(table, data):
    logger.info(f"db_insert table={table} keys={list(data.keys())}")

def db_query(table, filters):
    logger.info(f"db_query table={table} filters={filters}")
    return []

# --- Cache ---
_cache = {}
def cache_get(key):
    entry = _cache.get(key)
    if entry and time.time() - entry[1] < 300:
        return entry[0]
    return None

def cache_set(key, value):
    _cache[key] = (value, time.time())

# --- Sanitization ---
def sanitize(s):
    if not isinstance(s, str): return s
    return html.escape(s.strip()[:2000])

# --- Handler ---
class TenantHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def respond(self, code, data):
        inc_requests()
        if code >= 400: inc_errors()
        body = json.dumps(data, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.end_headers()
        self.wfile.write(body)

    def check_jwt(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.respond(401, {"error": "unauthorized"})
            return None
        # In production: decode JWT, extract tenant_id + role
        # For now: accept any bearer token, extract tenant from X-Tenant-Id header
        tenant_id = self.headers.get("X-Tenant-Id", "platform")
        return tenant_id

    def read_body(self):
        cl = int(self.headers.get("Content-Length", 0))
        if cl <= 0: return {}
        try:
            return json.loads(self.rfile.read(cl))
        except Exception:
            return {}


    # ─── Domain Logic: Tenant Management ─────────────────────────────────────

    def validate_tenant_configuration(self, config):
        """Validate multi-tenant configuration."""
        errors = []
        if not config.get("tenant_id"): errors.append("Tenant ID required")
        if not config.get("tenant_name"): errors.append("Tenant name required")
        max_users = config.get("max_users", 0)
        if max_users < 1: errors.append("Max users must be >= 1")
        plan = config.get("plan", "")
        valid_plans = {"starter", "professional", "enterprise"}
        if plan not in valid_plans: errors.append(f"Invalid plan: {plan}")
        return {"valid": len(errors) == 0, "errors": errors}

    def compute_tenant_billing(self, usage):
        """Compute tenant billing based on usage metrics."""
        plan_rates = {"starter": 50000, "professional": 200000, "enterprise": 500000}
        base = plan_rates.get(usage.get("plan", "starter"), 100000)
        users = usage.get("active_users", 0)
        storage_gb = usage.get("storage_gb", 0)
        api_calls = usage.get("api_calls", 0)
        extra = max(0, users - 10) * 5000 + storage_gb * 500 + max(0, api_calls - 100000) * 0.01
        return {"base_charge": base, "overage": round(extra, 2), "total": round(base + extra, 2)}

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/healthz":
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME}); return
        if path == "/readyz":
            self.respond(200, {"ready": True}); return
        if path == "/livez":
            self.respond(200, {"live": True}); return
        if path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\ntenants_total {len(_tenants)}\n'.encode()); return

        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        tenant_id = self.check_jwt()
        if not tenant_id: return

        # GET /v1/tenants — list all tenants (platform owner only)
        if path == "/v1/tenants":
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            tenants_list = []
            with _tenant_lock:
                for t in _tenants.values():
                    tenants_list.append({k: v for k, v in t.items() if k != "sub_tenants" or True})
            self.respond(200, {"tenants": tenants_list, "total": len(tenants_list)}); return

        # GET /v1/tenants/{id} — get specific tenant
        if path.startswith("/v1/tenants/"):
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            with _tenant_lock:
                t = _tenants.get(tid)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            # Tenant can only see themselves, platform can see all
            if tenant_id != "platform" and tenant_id != tid:
                self.respond(403, {"error": "access_denied"}); return
            self.respond(200, {"tenant": t}); return

        # GET /v1/tiers — list available tiers
        if path == "/v1/tiers":
            self.respond(200, {"tiers": TIER_FEATURES}); return

        # GET /v1/tenant/features — get features for current tenant
        if path == "/v1/tenant/features":
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            tier = t.get("tier", "starter")
            features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
            self.respond(200, {
                "tenant_id": tenant_id,
                "tier": tier,
                "features": features,
                "branding": t.get("branding", {}),
            }); return

        # GET /v1/tenant/branding — get white-label branding
        if path == "/v1/tenant/branding":
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            self.respond(200, {
                "tenant_id": tenant_id,
                "branding": t.get("branding", {}),
                "config": t.get("config", {}),
            }); return

        # GET /v1/tenant/usage — get usage stats
        if path == "/v1/tenant/usage":
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            tier = t.get("tier", "starter")
            features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
            usage = t.get("usage", {})
            self.respond(200, {
                "tenant_id": tenant_id,
                "tier": tier,
                "usage": usage,
                "limits": {
                    "max_users": features["max_users"],
                    "api_rate_limit": features["api_rate_limit"],
                    "data_retention_days": features["data_retention_days"],
                    "max_branches": features["max_branches"],
                },
            }); return

        self.respond(404, {"error": "not_found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        tenant_id = self.check_jwt()
        if not tenant_id: return
        body = self.read_body()

        # POST /v1/tenants — create new tenant (platform owner only)
        if path == "/v1/tenants":
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            name = sanitize(body.get("name", ""))
            slug = sanitize(body.get("slug", ""))
            tier = body.get("tier", "starter")
            owner_email = sanitize(body.get("owner_email", ""))
            if not name or not slug or not owner_email:
                self.respond(400, {"error": "name, slug, and owner_email required"}); return
            if tier not in TIER_FEATURES:
                self.respond(400, {"error": f"invalid tier, must be one of: {list(TIER_FEATURES.keys())}"}); return
            # Check slug uniqueness
            with _tenant_lock:
                for t in _tenants.values():
                    if t.get("slug") == slug:
                        self.respond(409, {"error": "slug_already_exists"}); return
            new_tenant = {
                "id": str(uuid.uuid4()),
                "name": name,
                "slug": slug,
                "tier": tier,
                "status": "active",
                "parent_tenant_id": tenant_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "owner_email": owner_email,
                "branding": body.get("branding", {
                    "logo_url": "",
                    "primary_color": "#1a237e",
                    "secondary_color": "#0d47a1",
                    "accent_color": "#ff6f00",
                    "app_name": name,
                    "favicon_url": "",
                    "custom_css": "",
                }),
                "config": body.get("config", {
                    "default_currency": "NGN",
                    "timezone": "Africa/Lagos",
                    "locale": "en-NG",
                    "mfa_required": False,
                    "ip_whitelist": [],
                    "webhook_url": "",
                }),
                "usage": {"active_users": 0, "total_transactions": 0, "storage_mb": 0, "api_calls_today": 0},
                "sub_tenants": [],
            }
            with _tenant_lock:
                _tenants[new_tenant["id"]] = new_tenant
                if tenant_id in _tenants:
                    _tenants[tenant_id]["sub_tenants"].append(new_tenant["id"])
            db_insert("tenants", new_tenant)
            cache_set(f"tenant:{new_tenant['id']}", new_tenant)
            logger.info(f"Tenant created: {new_tenant['id']} name={name} tier={tier}")
            self.respond(201, {"tenant": new_tenant}); return

        # POST /v1/tenants/{id}/tier — update tenant tier
        if path.startswith("/v1/tenants/") and path.endswith("/tier"):
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            new_tier = body.get("tier", "")
            if new_tier not in TIER_FEATURES:
                self.respond(400, {"error": f"invalid tier"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                t["tier"] = new_tier
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Tenant {tid} tier updated to {new_tier}")
            self.respond(200, {"tenant": t}); return

        # POST /v1/tenants/{id}/branding — update white-label branding
        if path.startswith("/v1/tenants/") and path.endswith("/branding"):
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            if tenant_id != "platform" and tenant_id != tid:
                self.respond(403, {"error": "access_denied"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                tier = t.get("tier", "starter")
                if not TIER_FEATURES.get(tier, {}).get("white_label", False) and tenant_id != "platform":
                    self.respond(403, {"error": "white_label_not_available_on_tier", "tier": tier}); return
                branding = t.get("branding", {})
                for key in ["logo_url", "primary_color", "secondary_color", "accent_color", "app_name", "favicon_url", "custom_css"]:
                    if key in body:
                        branding[key] = sanitize(body[key]) if isinstance(body[key], str) else body[key]
                t["branding"] = branding
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Tenant {tid} branding updated")
            self.respond(200, {"tenant": t}); return

        # POST /v1/tenants/{id}/status — activate/suspend tenant
        if path.startswith("/v1/tenants/") and path.endswith("/status"):
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            new_status = body.get("status", "")
            if new_status not in ("active", "suspended", "deactivated"):
                self.respond(400, {"error": "status must be active, suspended, or deactivated"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                t["status"] = new_status
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Tenant {tid} status updated to {new_status}")
            self.respond(200, {"tenant": t}); return

        # POST /v1/tenant/validate — validate tenant access to a feature
        if path == "/v1/tenant/validate":
            feature = body.get("feature", "")
            agent = body.get("agent", "")
            kpi_role = body.get("kpi_role", "")
            graph_tool = body.get("graph_tool", "")
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            if t.get("status") != "active":
                self.respond(403, {"error": "tenant_suspended", "status": t.get("status")}); return
            tier = t.get("tier", "starter")
            tier_features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
            allowed = True
            reason = ""
            if agent and agent not in tier_features["agents"]:
                allowed = False
                reason = f"Agent '{agent}' not available on {tier} tier"
            if kpi_role and kpi_role not in tier_features["kpi_roles"]:
                allowed = False
                reason = f"KPI role '{kpi_role}' not available on {tier} tier"
            if graph_tool and graph_tool not in tier_features["graph_tools"]:
                allowed = False
                reason = f"Graph tool '{graph_tool}' not available on {tier} tier"
            if feature and feature not in tier_features["features"]:
                allowed = False
                reason = f"Feature '{feature}' not available on {tier} tier"
            self.respond(200, {
                "allowed": allowed,
                "reason": reason,
                "tenant_id": tenant_id,
                "tier": tier,
            }); return

        self.respond(404, {"error": "not_found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        tenant_id = self.check_jwt()
        if not tenant_id: return
        body = self.read_body()

        # PUT /v1/tenants/{id} — update tenant config
        if path.startswith("/v1/tenants/"):
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            if tenant_id != "platform" and tenant_id != tid:
                self.respond(403, {"error": "access_denied"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                for key in ["name", "owner_email"]:
                    if key in body: t[key] = sanitize(body[key])
                if "config" in body:
                    config = t.get("config", {})
                    for k, v in body["config"].items():
                        config[k] = v
                    t["config"] = config
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            self.respond(200, {"tenant": t}); return

        self.respond(404, {"error": "not_found"})

if __name__ == "__main__":
    def shutdown(sig, frame):
        logger.info("Shutting down gracefully"); sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    server = HTTPServer(("0.0.0.0", PORT), TenantHandler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "tenants": len(_tenants)}))
    server.serve_forever()
