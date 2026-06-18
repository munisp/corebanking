/**
 * APISIX & OpenAppSec Deep Integration
 *
 * Services:
 * - apisix-gateway-go (Go :8275) — route management, plugin orchestration, upstream health
 * - openappsec-waf-rs (Rust :8276) — WAF rule engine, threat detection, ML-based anomaly scoring
 * - apisix-analytics-py (Python :8277) — traffic analytics, rate limit tuning, API usage dashboards
 */

// ── 1. APISIX Routes & Upstreams ──

interface APISIXRoute {
  id: string;
  name: string;
  uri: string;
  methods: string[];
  upstream: string;
  upstreamPort: number;
  plugins: string[];
  status: "active" | "disabled" | "error";
  requestsPerSec: number;
  avgLatencyMs: number;
  errorRate: number;
  lastHealthCheck: string;
  priority: number;
}

interface APISIXUpstream {
  id: string;
  name: string;
  service: string;
  nodes: { host: string; port: number; weight: number }[];
  type: "roundrobin" | "chash" | "ewma" | "least_conn";
  healthCheck: { active: boolean; interval: number; httpPath: string; healthy: number; unhealthy: number };
  retries: number;
  retryTimeout: number;
  connectTimeout: number;
  sendTimeout: number;
  readTimeout: number;
  status: "healthy" | "degraded" | "down";
}

interface APISIXPlugin {
  id: string;
  name: string;
  scope: "global" | "route" | "consumer";
  category: "authentication" | "security" | "traffic" | "observability" | "transformation";
  routesUsing: number;
  config: Record<string, unknown>;
  status: "enabled" | "disabled";
  description: string;
}

const apisixRoutes: APISIXRoute[] = [
  { id: "RT-001", name: "Core Banking API", uri: "/api/core-banking/*", methods: ["GET", "POST", "PUT", "DELETE"], upstream: "core-banking-go", upstreamPort: 8100, plugins: ["jwt-auth", "rate-limiting", "cors", "request-id", "openappsec-waf", "prometheus"], status: "active", requestsPerSec: 2500, avgLatencyMs: 12, errorRate: 0.002, lastHealthCheck: new Date().toISOString(), priority: 100 },
  { id: "RT-002", name: "Payments Hub", uri: "/api/payments/*", methods: ["GET", "POST", "PUT"], upstream: "payments-hub-go", upstreamPort: 8101, plugins: ["jwt-auth", "rate-limiting", "idempotency", "openappsec-waf", "prometheus", "request-validation"], status: "active", requestsPerSec: 4200, avgLatencyMs: 8, errorRate: 0.001, lastHealthCheck: new Date().toISOString(), priority: 100 },
  { id: "RT-003", name: "Mojaloop Connector", uri: "/api/mojaloop/*", methods: ["GET", "POST", "PUT", "PATCH"], upstream: "mojaloop-connector-go", upstreamPort: 8124, plugins: ["jwt-auth", "rate-limiting", "openappsec-waf", "cors", "prometheus", "fault-injection"], status: "active", requestsPerSec: 850, avgLatencyMs: 18, errorRate: 0.003, lastHealthCheck: new Date().toISOString(), priority: 95 },
  { id: "RT-004", name: "TigerBeetle Ledger", uri: "/api/tigerbeetle/*", methods: ["GET", "POST"], upstream: "tigerbeetle-proxy-rs", upstreamPort: 8200, plugins: ["jwt-auth", "rate-limiting", "openappsec-waf", "prometheus", "request-id"], status: "active", requestsPerSec: 8500, avgLatencyMs: 3, errorRate: 0.0005, lastHealthCheck: new Date().toISOString(), priority: 100 },
  { id: "RT-005", name: "KYC/AML Engine", uri: "/api/kyc/*", methods: ["GET", "POST", "PUT"], upstream: "kyc-engine-py", upstreamPort: 8110, plugins: ["jwt-auth", "rate-limiting", "openappsec-waf", "prometheus", "ip-restriction"], status: "active", requestsPerSec: 320, avgLatencyMs: 45, errorRate: 0.005, lastHealthCheck: new Date().toISOString(), priority: 90 },
  { id: "RT-006", name: "Fraud Detection", uri: "/api/fraud/*", methods: ["GET", "POST"], upstream: "fraud-detection-rs", upstreamPort: 8115, plugins: ["jwt-auth", "rate-limiting", "openappsec-waf", "prometheus", "consumer-restriction"], status: "active", requestsPerSec: 1200, avgLatencyMs: 5, errorRate: 0.001, lastHealthCheck: new Date().toISOString(), priority: 100 },
  { id: "RT-007", name: "Lakehouse Analytics", uri: "/api/lakehouse/*", methods: ["GET", "POST"], upstream: "lakehouse-rs", upstreamPort: 8126, plugins: ["jwt-auth", "rate-limiting", "prometheus", "response-rewrite"], status: "active", requestsPerSec: 45, avgLatencyMs: 250, errorRate: 0.008, lastHealthCheck: new Date().toISOString(), priority: 70 },
  { id: "RT-008", name: "Settlement Engine", uri: "/api/settlement/*", methods: ["GET", "POST", "PUT"], upstream: "settlement-engine-rs", upstreamPort: 8104, plugins: ["jwt-auth", "rate-limiting", "openappsec-waf", "prometheus", "idempotency", "request-validation"], status: "active", requestsPerSec: 180, avgLatencyMs: 22, errorRate: 0.002, lastHealthCheck: new Date().toISOString(), priority: 95 },
];

const apisixUpstreams: APISIXUpstream[] = [
  { id: "UP-001", name: "core-banking-go", service: "core-banking-go", nodes: [{ host: "core-banking-1.54bank.internal", port: 8100, weight: 100 }, { host: "core-banking-2.54bank.internal", port: 8100, weight: 100 }], type: "roundrobin", healthCheck: { active: true, interval: 5, httpPath: "/healthz", healthy: 2, unhealthy: 3 }, retries: 3, retryTimeout: 5, connectTimeout: 5, sendTimeout: 10, readTimeout: 10, status: "healthy" },
  { id: "UP-002", name: "payments-hub-go", service: "payments-hub-go", nodes: [{ host: "payments-1.54bank.internal", port: 8101, weight: 100 }, { host: "payments-2.54bank.internal", port: 8101, weight: 100 }, { host: "payments-3.54bank.internal", port: 8101, weight: 100 }], type: "least_conn", healthCheck: { active: true, interval: 3, httpPath: "/healthz", healthy: 2, unhealthy: 2 }, retries: 3, retryTimeout: 3, connectTimeout: 3, sendTimeout: 5, readTimeout: 5, status: "healthy" },
  { id: "UP-003", name: "mojaloop-connector-go", service: "mojaloop-connector-go", nodes: [{ host: "mojaloop-1.54bank.internal", port: 8124, weight: 100 }], type: "roundrobin", healthCheck: { active: true, interval: 5, httpPath: "/healthz", healthy: 2, unhealthy: 3 }, retries: 2, retryTimeout: 5, connectTimeout: 5, sendTimeout: 15, readTimeout: 30, status: "healthy" },
  { id: "UP-004", name: "tigerbeetle-proxy-rs", service: "tigerbeetle-proxy-rs", nodes: [{ host: "tigerbeetle-1.54bank.internal", port: 8200, weight: 100 }, { host: "tigerbeetle-2.54bank.internal", port: 8200, weight: 100 }], type: "chash", healthCheck: { active: true, interval: 2, httpPath: "/healthz", healthy: 3, unhealthy: 2 }, retries: 1, retryTimeout: 2, connectTimeout: 2, sendTimeout: 3, readTimeout: 3, status: "healthy" },
];

const apisixPlugins: APISIXPlugin[] = [
  { id: "PLG-001", name: "jwt-auth", scope: "global", category: "authentication", routesUsing: 175, config: { key: "X-API-Key", secret_is_base64: false, algorithm: "RS256", exp: 300, issuer: "keycloak.54bank.app" }, status: "enabled", description: "JWT validation via Keycloak public key — RS256, 5min expiry, issuer verification" },
  { id: "PLG-002", name: "limit-req", scope: "global", category: "traffic", routesUsing: 175, config: { rate: 100, burst: 50, key: "consumer_name", rejected_code: 429 }, status: "enabled", description: "Per-consumer request rate limiting with token bucket algorithm" },
  { id: "PLG-003", name: "openappsec-waf", scope: "global", category: "security", routesUsing: 160, config: { mode: "prevent", confidence_level: "high", log_level: "info", custom_rules: 12 }, status: "enabled", description: "ML-based WAF — SQL injection, XSS, command injection, path traversal protection" },
  { id: "PLG-004", name: "prometheus", scope: "global", category: "observability", routesUsing: 175, config: { prefer_name: true, export_uri: "/apisix/prometheus/metrics" }, status: "enabled", description: "Prometheus metrics exporter — request count, latency histograms, upstream health" },
  { id: "PLG-005", name: "cors", scope: "global", category: "security", routesUsing: 175, config: { allow_origins: "https://app.54bank.app,https://admin.54bank.app", allow_methods: "GET,POST,PUT,DELETE,OPTIONS", allow_headers: "Authorization,Content-Type,X-Correlation-ID", max_age: 3600 }, status: "enabled", description: "CORS enforcement — whitelist trusted origins, preflight caching" },
  { id: "PLG-006", name: "ip-restriction", scope: "route", category: "security", routesUsing: 25, config: { whitelist: ["10.0.0.0/8", "172.16.0.0/12", "41.0.0.0/8"] }, status: "enabled", description: "IP whitelist for admin/internal routes — Nigerian IP ranges + internal subnets" },
  { id: "PLG-007", name: "request-validation", scope: "route", category: "transformation", routesUsing: 45, config: { header_schema: {}, body_schema: {}, rejected_code: 422 }, status: "enabled", description: "JSON Schema validation on request body for write operations" },
  { id: "PLG-008", name: "consumer-restriction", scope: "route", category: "authentication", routesUsing: 30, config: { type: "consumer_name", whitelist: ["54bank-internal", "admin-api", "batch-processor"] }, status: "enabled", description: "Restrict sensitive routes to specific API consumers" },
];

// ── 2. OpenAppSec WAF ──

interface WAFRule {
  id: string;
  name: string;
  category: "sql_injection" | "xss" | "command_injection" | "path_traversal" | "file_inclusion" | "request_smuggling" | "bot_detection" | "api_abuse" | "data_exfiltration" | "credential_stuffing";
  mode: "prevent" | "detect" | "log_only";
  severity: "critical" | "high" | "medium" | "low";
  matchCount24h: number;
  blockCount24h: number;
  falsePositiveRate: number;
  mlConfidence: number;
  lastTriggered: string;
  description: string;
}

interface WAFEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  sourceIP: string;
  uri: string;
  method: string;
  action: "blocked" | "detected" | "logged";
  severity: "critical" | "high" | "medium" | "low";
  attackPayload: string;
  mlScore: number;
  geoCountry: string;
  userAgent: string;
  detectedAt: string;
}

const wafRules: WAFRule[] = [
  { id: "WAF-001", name: "SQL Injection Prevention", category: "sql_injection", mode: "prevent", severity: "critical", matchCount24h: 1250, blockCount24h: 1248, falsePositiveRate: 0.002, mlConfidence: 0.98, lastTriggered: new Date(Date.now() - 120000).toISOString(), description: "ML-trained SQL injection detection — handles UNION, blind, time-based, stacked queries" },
  { id: "WAF-002", name: "XSS Prevention", category: "xss", mode: "prevent", severity: "high", matchCount24h: 890, blockCount24h: 888, falsePositiveRate: 0.003, mlConfidence: 0.97, lastTriggered: new Date(Date.now() - 300000).toISOString(), description: "Cross-site scripting — reflected, stored, DOM-based with context-aware encoding detection" },
  { id: "WAF-003", name: "Command Injection Shield", category: "command_injection", mode: "prevent", severity: "critical", matchCount24h: 320, blockCount24h: 320, falsePositiveRate: 0.0, mlConfidence: 0.99, lastTriggered: new Date(Date.now() - 600000).toISOString(), description: "OS command injection — pipes, backticks, $(), semicolons in parameters" },
  { id: "WAF-004", name: "Path Traversal Guard", category: "path_traversal", mode: "prevent", severity: "high", matchCount24h: 450, blockCount24h: 450, falsePositiveRate: 0.001, mlConfidence: 0.99, lastTriggered: new Date(Date.now() - 180000).toISOString(), description: "Directory traversal — ../, URL-encoded variants, null byte injection" },
  { id: "WAF-005", name: "Bot Detection (ML)", category: "bot_detection", mode: "prevent", severity: "medium", matchCount24h: 8500, blockCount24h: 7200, falsePositiveRate: 0.015, mlConfidence: 0.92, lastTriggered: new Date(Date.now() - 5000).toISOString(), description: "ML-based bot detection — fingerprinting, behavioral analysis, rate anomaly, headless browser detection" },
  { id: "WAF-006", name: "API Abuse Prevention", category: "api_abuse", mode: "prevent", severity: "high", matchCount24h: 2200, blockCount24h: 2100, falsePositiveRate: 0.005, mlConfidence: 0.95, lastTriggered: new Date(Date.now() - 60000).toISOString(), description: "API abuse patterns — enumeration, scraping, bulk account creation, credential spraying" },
  { id: "WAF-007", name: "Data Exfiltration Shield", category: "data_exfiltration", mode: "prevent", severity: "critical", matchCount24h: 85, blockCount24h: 85, falsePositiveRate: 0.0, mlConfidence: 0.99, lastTriggered: new Date(Date.now() - 3600000).toISOString(), description: "Prevents bulk data extraction — response size anomaly, pagination abuse, GraphQL introspection" },
  { id: "WAF-008", name: "Credential Stuffing Shield", category: "credential_stuffing", mode: "prevent", severity: "critical", matchCount24h: 5200, blockCount24h: 5180, falsePositiveRate: 0.004, mlConfidence: 0.96, lastTriggered: new Date(Date.now() - 30000).toISOString(), description: "Credential stuffing defense — login rate anomaly, known-leaked password DB, GeoIP velocity check" },
];

const wafEvents: WAFEvent[] = [
  { id: "EVT-001", ruleId: "WAF-001", ruleName: "SQL Injection", sourceIP: "185.220.101.42", uri: "/api/customers?id=1' OR '1'='1", method: "GET", action: "blocked", severity: "critical", attackPayload: "1' OR '1'='1", mlScore: 0.99, geoCountry: "Romania", userAgent: "Mozilla/5.0 (compatible)", detectedAt: new Date(Date.now() - 120000).toISOString() },
  { id: "EVT-002", ruleId: "WAF-008", ruleName: "Credential Stuffing", sourceIP: "103.152.220.15", uri: "/api/auth/login", method: "POST", action: "blocked", severity: "critical", attackPayload: "{username:test@54bank.app,password:...}", mlScore: 0.97, geoCountry: "Vietnam", userAgent: "python-requests/2.28", detectedAt: new Date(Date.now() - 30000).toISOString() },
  { id: "EVT-003", ruleId: "WAF-005", ruleName: "Bot Detection", sourceIP: "45.33.32.156", uri: "/api/accounts", method: "GET", action: "blocked", severity: "medium", attackPayload: "automated_enumeration", mlScore: 0.94, geoCountry: "United States", userAgent: "Scrapy/2.8", detectedAt: new Date(Date.now() - 5000).toISOString() },
  { id: "EVT-004", ruleId: "WAF-004", ruleName: "Path Traversal", sourceIP: "91.121.87.18", uri: "/api/documents/../../../etc/passwd", method: "GET", action: "blocked", severity: "high", attackPayload: "../../../etc/passwd", mlScore: 0.99, geoCountry: "France", userAgent: "curl/7.88", detectedAt: new Date(Date.now() - 180000).toISOString() },
];

// ── 3. Keycloak Deep Integration ──

interface KeycloakRealm {
  id: string;
  name: string;
  displayName: string;
  sslRequired: string;
  totalUsers: number;
  activeUsers24h: number;
  totalClients: number;
  totalGroups: number;
  totalRoles: number;
  mfaEnforced: boolean;
  passwordPolicy: string;
  bruteForceProtected: boolean;
  loginFailures24h: number;
  accessTokenLifespan: number;
  refreshTokenLifespan: number;
  ssoSessionMaxLifespan: number;
  status: "active" | "maintenance" | "locked";
}

interface KeycloakClient {
  id: string;
  clientId: string;
  name: string;
  protocol: "openid-connect" | "saml";
  accessType: "public" | "confidential" | "bearer-only";
  serviceAccountEnabled: boolean;
  directAccessGrantsEnabled: boolean;
  standardFlowEnabled: boolean;
  implicitFlowEnabled: boolean;
  redirectUris: string[];
  scopes: string[];
  activeTokens: number;
  requestsPerDay: number;
  status: "active" | "disabled";
}

interface KeycloakRole {
  id: string;
  name: string;
  realm: string;
  composite: boolean;
  clientRole: boolean;
  description: string;
  usersAssigned: number;
  permissions: string[];
}

interface KeycloakIdP {
  id: string;
  alias: string;
  displayName: string;
  providerId: "oidc" | "saml" | "google" | "microsoft" | "apple" | "facebook";
  enabled: boolean;
  trustEmail: boolean;
  firstBrokerLoginFlowAlias: string;
  syncMode: "INHERIT" | "FORCE" | "IMPORT";
  usersLinked: number;
  loginCount30d: number;
  status: "active" | "inactive" | "error";
}

const keycloakRealms: KeycloakRealm[] = [
  { id: "KC-REALM-001", name: "54bank", displayName: "54Bank Nigeria", sslRequired: "external", totalUsers: 1500000, activeUsers24h: 85000, totalClients: 24, totalGroups: 18, totalRoles: 45, mfaEnforced: true, passwordPolicy: "length(12) and digits(1) and upperCase(1) and specialChars(1) and notUsername and passwordHistory(5)", bruteForceProtected: true, loginFailures24h: 2500, accessTokenLifespan: 300, refreshTokenLifespan: 1800, ssoSessionMaxLifespan: 36000, status: "active" },
  { id: "KC-REALM-002", name: "54bank-admin", displayName: "54Bank Admin Portal", sslRequired: "all", totalUsers: 450, activeUsers24h: 120, totalClients: 8, totalGroups: 6, totalRoles: 25, mfaEnforced: true, passwordPolicy: "length(16) and digits(2) and upperCase(2) and specialChars(2) and notUsername and passwordHistory(10) and forceExpiredPasswordChange(90)", bruteForceProtected: true, loginFailures24h: 15, accessTokenLifespan: 180, refreshTokenLifespan: 900, ssoSessionMaxLifespan: 14400, status: "active" },
  { id: "KC-REALM-003", name: "54bank-api", displayName: "54Bank API Consumers", sslRequired: "all", totalUsers: 85, activeUsers24h: 42, totalClients: 35, totalGroups: 4, totalRoles: 15, mfaEnforced: false, passwordPolicy: "length(32)", bruteForceProtected: true, loginFailures24h: 5, accessTokenLifespan: 600, refreshTokenLifespan: 3600, ssoSessionMaxLifespan: 86400, status: "active" },
];

const keycloakClients: KeycloakClient[] = [
  { id: "KC-CLT-001", clientId: "54bank-pwa", name: "54Bank PWA", protocol: "openid-connect", accessType: "public", serviceAccountEnabled: false, directAccessGrantsEnabled: false, standardFlowEnabled: true, implicitFlowEnabled: false, redirectUris: ["https://app.54bank.app/*", "http://localhost:5173/*"], scopes: ["openid", "profile", "email", "banking:read", "banking:write"], activeTokens: 45000, requestsPerDay: 2500000, status: "active" },
  { id: "KC-CLT-002", clientId: "54bank-mobile", name: "54Bank Flutter Mobile", protocol: "openid-connect", accessType: "public", serviceAccountEnabled: false, directAccessGrantsEnabled: false, standardFlowEnabled: true, implicitFlowEnabled: false, redirectUris: ["app.54bank://callback", "http://localhost:3000/callback"], scopes: ["openid", "profile", "email", "banking:read", "banking:write", "offline_access"], activeTokens: 120000, requestsPerDay: 8500000, status: "active" },
  { id: "KC-CLT-003", clientId: "54bank-admin-portal", name: "Admin Portal", protocol: "openid-connect", accessType: "confidential", serviceAccountEnabled: true, directAccessGrantsEnabled: false, standardFlowEnabled: true, implicitFlowEnabled: false, redirectUris: ["https://admin.54bank.app/*"], scopes: ["openid", "profile", "email", "admin:full", "audit:read"], activeTokens: 85, requestsPerDay: 45000, status: "active" },
  { id: "KC-CLT-004", clientId: "mojaloop-connector", name: "Mojaloop Connector", protocol: "openid-connect", accessType: "confidential", serviceAccountEnabled: true, directAccessGrantsEnabled: true, standardFlowEnabled: false, implicitFlowEnabled: false, redirectUris: [], scopes: ["openid", "mojaloop:transfer", "mojaloop:settlement", "mojaloop:admin"], activeTokens: 12, requestsPerDay: 850000, status: "active" },
  { id: "KC-CLT-005", clientId: "tigerbeetle-bridge", name: "TigerBeetle Bridge", protocol: "openid-connect", accessType: "bearer-only", serviceAccountEnabled: true, directAccessGrantsEnabled: false, standardFlowEnabled: false, implicitFlowEnabled: false, redirectUris: [], scopes: ["openid", "ledger:read", "ledger:write", "reconciliation:run"], activeTokens: 4, requestsPerDay: 12000000, status: "active" },
  { id: "KC-CLT-006", clientId: "nibss-gateway", name: "NIBSS NIP Gateway", protocol: "openid-connect", accessType: "confidential", serviceAccountEnabled: true, directAccessGrantsEnabled: true, standardFlowEnabled: false, implicitFlowEnabled: false, redirectUris: [], scopes: ["openid", "nip:transfer", "nip:lookup", "settlement:read"], activeTokens: 8, requestsPerDay: 4500000, status: "active" },
];

const keycloakRoles: KeycloakRole[] = [
  { id: "KC-ROLE-001", name: "bank_customer", realm: "54bank", composite: true, clientRole: false, description: "Standard bank customer — view accounts, initiate transfers, manage beneficiaries", usersAssigned: 1450000, permissions: ["account:read", "transfer:create", "beneficiary:manage", "statement:download", "profile:edit"] },
  { id: "KC-ROLE-002", name: "premium_customer", realm: "54bank", composite: true, clientRole: false, description: "Premium customer — all standard + investment, FX, priority support", usersAssigned: 45000, permissions: ["account:read", "transfer:create", "beneficiary:manage", "statement:download", "profile:edit", "investment:manage", "fx:trade", "priority:support"] },
  { id: "KC-ROLE-003", name: "corporate_admin", realm: "54bank", composite: true, clientRole: false, description: "Corporate banking admin — bulk transfers, payroll, maker-checker approvals", usersAssigned: 2500, permissions: ["account:read", "transfer:create", "transfer:bulk", "payroll:manage", "maker_checker:approve", "report:download"] },
  { id: "KC-ROLE-004", name: "branch_teller", realm: "54bank-admin", composite: true, clientRole: false, description: "Branch teller — deposits, withdrawals, account opening, customer service", usersAssigned: 180, permissions: ["account:read", "account:create", "deposit:create", "withdrawal:create", "customer:view", "kyc:initiate"] },
  { id: "KC-ROLE-005", name: "compliance_officer", realm: "54bank-admin", composite: true, clientRole: false, description: "AML/KYC compliance — review alerts, file STRs, manage sanctions screening", usersAssigned: 25, permissions: ["aml:read", "aml:review", "str:file", "sanctions:manage", "kyc:approve", "customer:view", "audit:read"] },
  { id: "KC-ROLE-006", name: "treasury_operator", realm: "54bank-admin", composite: true, clientRole: false, description: "Treasury desk — FX trading, money market, liquidity management", usersAssigned: 12, permissions: ["fx:trade", "fx:approve", "money_market:manage", "liquidity:view", "nostro:manage", "position:view"] },
  { id: "KC-ROLE-007", name: "system_admin", realm: "54bank-admin", composite: true, clientRole: false, description: "IT system admin — full platform access, service management, deployment", usersAssigned: 8, permissions: ["admin:full", "service:manage", "deploy:execute", "config:edit", "secret:manage", "audit:read"] },
  { id: "KC-ROLE-008", name: "api_consumer", realm: "54bank-api", composite: false, clientRole: false, description: "Third-party API consumer — Open Banking endpoints, sandbox access", usersAssigned: 85, permissions: ["openbanking:read", "openbanking:initiate", "sandbox:access"] },
];

const keycloakIdPs: KeycloakIdP[] = [
  { id: "KC-IDP-001", alias: "nibss-bvn", displayName: "NIBSS BVN Verification", providerId: "oidc", enabled: true, trustEmail: false, firstBrokerLoginFlowAlias: "bvn-verification-flow", syncMode: "IMPORT", usersLinked: 1400000, loginCount30d: 0, status: "active" },
  { id: "KC-IDP-002", alias: "google-sso", displayName: "Google SSO (Corporate)", providerId: "google", enabled: true, trustEmail: true, firstBrokerLoginFlowAlias: "google-corporate-flow", syncMode: "INHERIT", usersLinked: 320, loginCount30d: 8500, status: "active" },
  { id: "KC-IDP-003", alias: "microsoft-ad", displayName: "Microsoft AD (Staff)", providerId: "microsoft", enabled: true, trustEmail: true, firstBrokerLoginFlowAlias: "ms-ad-staff-flow", syncMode: "FORCE", usersLinked: 450, loginCount30d: 12000, status: "active" },
  { id: "KC-IDP-004", alias: "apple-sign-in", displayName: "Apple Sign-In (Mobile)", providerId: "apple", enabled: true, trustEmail: true, firstBrokerLoginFlowAlias: "apple-mobile-flow", syncMode: "INHERIT", usersLinked: 85000, loginCount30d: 250000, status: "active" },
];

// ── Express Registration ──

export function registerApisixOpenappsecIntegration(app: any) {
  // APISIX
  app.get("/api/platform/apisix/routes", (_req: any, res: any) => {
    res.json({ items: apisixRoutes, total: apisixRoutes.length });
  });
  app.get("/api/platform/apisix/upstreams", (_req: any, res: any) => {
    res.json({ items: apisixUpstreams, total: apisixUpstreams.length });
  });
  app.get("/api/platform/apisix/plugins", (_req: any, res: any) => {
    res.json({ items: apisixPlugins, total: apisixPlugins.length });
  });
  app.get("/api/platform/apisix/stats", (_req: any, res: any) => {
    const totalRPS = apisixRoutes.reduce((s, r) => s + r.requestsPerSec, 0);
    const avgLatency = apisixRoutes.reduce((s, r) => s + r.avgLatencyMs, 0) / apisixRoutes.length;
    res.json({ totalRoutes: apisixRoutes.length, totalUpstreams: apisixUpstreams.length, totalPlugins: apisixPlugins.length, totalRPS, avgLatencyMs: Math.round(avgLatency * 10) / 10, healthyUpstreams: apisixUpstreams.filter(u => u.status === "healthy").length });
  });

  // OpenAppSec WAF
  app.get("/api/platform/openappsec/rules", (_req: any, res: any) => {
    res.json({ items: wafRules, total: wafRules.length });
  });
  app.get("/api/platform/openappsec/events", (_req: any, res: any) => {
    res.json({ items: wafEvents, total: wafEvents.length });
  });
  app.get("/api/platform/openappsec/stats", (_req: any, res: any) => {
    const totalBlocked = wafRules.reduce((s, r) => s + r.blockCount24h, 0);
    const avgConfidence = wafRules.reduce((s, r) => s + r.mlConfidence, 0) / wafRules.length;
    res.json({ totalRules: wafRules.length, totalBlocked24h: totalBlocked, totalDetected24h: wafRules.reduce((s, r) => s + r.matchCount24h, 0), avgMLConfidence: Math.round(avgConfidence * 1000) / 1000, criticalRules: wafRules.filter(r => r.severity === "critical").length });
  });

  // Keycloak
  app.get("/api/platform/keycloak/realms", (_req: any, res: any) => {
    res.json({ items: keycloakRealms, total: keycloakRealms.length });
  });
  app.get("/api/platform/keycloak/clients", (_req: any, res: any) => {
    res.json({ items: keycloakClients, total: keycloakClients.length });
  });
  app.get("/api/platform/keycloak/roles", (_req: any, res: any) => {
    res.json({ items: keycloakRoles, total: keycloakRoles.length });
  });
  app.get("/api/platform/keycloak/identity-providers", (_req: any, res: any) => {
    res.json({ items: keycloakIdPs, total: keycloakIdPs.length });
  });
  app.get("/api/platform/keycloak/stats", (_req: any, res: any) => {
    const totalUsers = keycloakRealms.reduce((s, r) => s + r.totalUsers, 0);
    const activeUsers = keycloakRealms.reduce((s, r) => s + r.activeUsers24h, 0);
    res.json({ totalRealms: keycloakRealms.length, totalUsers, activeUsers24h: activeUsers, totalClients: keycloakClients.length, totalRoles: keycloakRoles.length, totalIdPs: keycloakIdPs.length, mfaEnforced: keycloakRealms.filter(r => r.mfaEnforced).length });
  });
}
