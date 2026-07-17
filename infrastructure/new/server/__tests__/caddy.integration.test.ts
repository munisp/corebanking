/**
 * 54Bank — Caddy Gateway Integration Tests
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tests for the Caddy gateway integration layer, covering:
 *  - Admin API connectivity and config management
 *  - Route management (add/remove/list)
 *  - TLS certificate management
 *  - Rate limit configuration
 *  - APISIX upstream management
 *  - Keycloak forward_auth integration
 *  - OpenAppSec WAF mode toggling
 *  - Express middleware (requireCaddyRequestId, extractCaddyAuthHeaders)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock fetch globally ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import after mocking ───────────────────────────────────────────────────────
import {
  getCaddyConfig,
  reloadCaddyConfig,
  updateCaddyConfigPath,
  addCaddyRoute,
  removeCaddyRoute,
  getCaddyRoutes,
  registerServiceRoute,
  deregisterServiceRoute,
  listTLSCertificates,
  checkExpiringCertificates,
  issueInternalCertificate,
  checkCaddyHealth,
  getCaddyMetrics,
  updateApisixUpstream,
  setWafEnforcementMode,
  updateKeycloakRealmUrl,
  getRateLimitStats,
  updateRateLimit,
  requireCaddyRequestId,
  extractCaddyAuthHeaders,
} from "../../lib/caddyGateway";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockOk(body: unknown, contentType = "application/json") {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    text: () =>
      Promise.resolve(
        contentType === "text/plain"
          ? (body as string)
          : JSON.stringify(body)
      ),
  } as Response);
}

function mockError(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(message),
  } as Response);
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe("Caddy Gateway Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Config Management ────────────────────────────────────────────────────────

  describe("Configuration Management", () => {
    it("getCaddyConfig — returns parsed config from Admin API", async () => {
      const mockConfig = {
        apps: { http: { servers: { main: { listen: [":443"] } } } },
        version: "2.9.0",
      };
      mockFetch.mockResolvedValueOnce(mockOk(mockConfig));

      const config = await getCaddyConfig();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/config/"),
        expect.objectContaining({ method: "GET" })
      );
      expect(config).toEqual(mockConfig);
    });

    it("reloadCaddyConfig — POSTs new config to /load", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));
      const newConfig = { apps: { http: {} } };

      await reloadCaddyConfig(newConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newConfig),
        })
      );
    });

    it("updateCaddyConfigPath — PATCHes a specific config path", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));
      const routes = [{ handle: [{ handler: "reverse_proxy" }] }];

      await updateCaddyConfigPath("/apps/http/servers/main/routes", routes);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/config/apps/http/servers/main/routes"),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("reloadCaddyConfig — throws on Admin API error", async () => {
      mockFetch.mockResolvedValueOnce(mockError(500, "internal error"));

      await expect(reloadCaddyConfig({})).rejects.toThrow("500");
    });
  });

  // ── Route Management ─────────────────────────────────────────────────────────

  describe("Route Management", () => {
    it("addCaddyRoute — POSTs route to correct server", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      const route = {
        "@id": "test-route",
        match: [{ path: ["/test/*"] }],
        handle: [{ handler: "reverse_proxy", upstreams: [{ dial: "localhost:8080" }] }],
      };

      await addCaddyRoute("main", route);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/apps/http/servers/main/routes/"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("removeCaddyRoute — DELETEs route by ID", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await removeCaddyRoute("service-payments-hub");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/id/service-payments-hub"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("getCaddyRoutes — GETs routes for main server", async () => {
      const mockRoutes = [
        { "@id": "route-1", handle: [{ handler: "reverse_proxy" }] },
        { "@id": "route-2", handle: [{ handler: "static_response" }] },
      ];
      mockFetch.mockResolvedValueOnce(mockOk(mockRoutes));

      const routes = await getCaddyRoutes("main");

      expect(routes).toHaveLength(2);
      expect(routes[0]["@id"]).toBe("route-1");
    });

    it("registerServiceRoute — creates a route with correct @id", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await registerServiceRoute({
        serviceId: "kyc-aml",
        hostPattern: "*.54bank.local",
        pathPrefix: "/api/v1/kyc",
        upstreamAddress: "kyc-aml:8136",
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body["@id"]).toBe("service-kyc-aml");
      expect(body.handle[0].upstreams[0].dial).toBe("kyc-aml:8136");
    });

    it("deregisterServiceRoute — removes route by service ID", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await deregisterServiceRoute("kyc-aml");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/id/service-kyc-aml"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ── TLS Certificate Management ───────────────────────────────────────────────

  describe("TLS Certificate Management", () => {
    it("listTLSCertificates — returns parsed certificate list", async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const mockCerts = [
        {
          subject: "54bank.local",
          issuer: "54Bank Internal CA",
          not_before: new Date().toISOString(),
          not_after: futureDate,
          serial: "abc123",
          san: ["54bank.local", "*.54bank.local"],
          is_managed: true,
        },
      ];
      mockFetch.mockResolvedValueOnce(mockOk(mockCerts));

      const certs = await listTLSCertificates();

      expect(certs).toHaveLength(1);
      expect(certs[0].subject).toBe("54bank.local");
      expect(certs[0].is_expired).toBe(false);
      expect(certs[0].days_remaining).toBeGreaterThan(50);
    });

    it("listTLSCertificates — returns empty array on API error", async () => {
      mockFetch.mockResolvedValueOnce(mockError(404, "not found"));

      const certs = await listTLSCertificates();
      expect(certs).toEqual([]);
    });

    it("checkExpiringCertificates — filters certs expiring within threshold", async () => {
      const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const farDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const mockCerts = [
        {
          subject: "expiring-soon.54bank.local",
          issuer: "54Bank Internal CA",
          not_before: new Date().toISOString(),
          not_after: soonDate,
          serial: "aaa",
          san: [],
          is_managed: true,
        },
        {
          subject: "healthy.54bank.local",
          issuer: "54Bank Internal CA",
          not_before: new Date().toISOString(),
          not_after: farDate,
          serial: "bbb",
          san: [],
          is_managed: true,
        },
      ];
      mockFetch.mockResolvedValueOnce(mockOk(mockCerts));

      const expiring = await checkExpiringCertificates(30);

      expect(expiring).toHaveLength(1);
      expect(expiring[0].subject).toBe("expiring-soon.54bank.local");
    });

    it("issueInternalCertificate — POSTs to PKI sign endpoint", async () => {
      const mockCert = { certificate: "-----BEGIN CERT-----", private_key: "-----BEGIN KEY-----" };
      mockFetch.mockResolvedValueOnce(mockOk(mockCert));

      const result = await issueInternalCertificate({
        commonName: "payments-hub.internal",
        sans: ["payments-hub", "payments-hub.54link-dev.svc.cluster.local"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/pki/ca/internal/sign"),
        expect.objectContaining({ method: "POST" })
      );
      expect(result.certificate).toContain("BEGIN CERT");
    });
  });

  // ── Health & Metrics ─────────────────────────────────────────────────────────

  describe("Health and Metrics", () => {
    it("checkCaddyHealth — returns healthy=true when Admin API responds", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({ version: "2.9.0" }));

      const health = await checkCaddyHealth();

      expect(health.healthy).toBe(true);
      expect(health.version).toBe("2.9.0");
    });

    it("checkCaddyHealth — returns healthy=false when Admin API is down", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const health = await checkCaddyHealth();

      expect(health.healthy).toBe(false);
    });

    it("getCaddyMetrics — returns Prometheus-format metrics string", async () => {
      const metricsText = "# HELP caddy_http_requests_total\ncaddy_http_requests_total 42";
      mockFetch.mockResolvedValueOnce(mockOk(metricsText, "text/plain"));

      const metrics = await getCaddyMetrics();

      expect(typeof metrics).toBe("string");
    });

    it("getCaddyMetrics — returns empty string on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));

      const metrics = await getCaddyMetrics();
      expect(metrics).toBe("");
    });
  });

  // ── APISIX Integration ───────────────────────────────────────────────────────

  describe("APISIX Integration", () => {
    it("updateApisixUpstream — PATCHes upstreams config path", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await updateApisixUpstream(["apisix:9080", "apisix-2:9080"]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/config/apps/http/servers/main/routes/0/handle/0/upstreams"),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("updateApisixUpstream — sends correct upstream dial addresses", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await updateApisixUpstream(["apisix:9080"]);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual([{ dial: "apisix:9080" }]);
    });
  });

  // ── OpenAppSec WAF Integration ───────────────────────────────────────────────

  describe("OpenAppSec WAF Integration", () => {
    it("setWafEnforcementMode — accepts learning mode without throwing", async () => {
      await expect(setWafEnforcementMode("learning")).resolves.not.toThrow();
    });

    it("setWafEnforcementMode — accepts prevention mode without throwing", async () => {
      await expect(setWafEnforcementMode("prevention")).resolves.not.toThrow();
    });

    it("setWafEnforcementMode — accepts disabled mode without throwing", async () => {
      await expect(setWafEnforcementMode("disabled")).resolves.not.toThrow();
    });
  });

  // ── Keycloak Integration ─────────────────────────────────────────────────────

  describe("Keycloak Integration", () => {
    it("updateKeycloakRealmUrl — accepts new realm URL without throwing", async () => {
      await expect(
        updateKeycloakRealmUrl("https://auth.54bank.com/realms/production")
      ).resolves.not.toThrow();
    });
  });

  // ── Rate Limit Management ────────────────────────────────────────────────────

  describe("Rate Limit Management", () => {
    it("getRateLimitStats — GETs server config for rate limit zones", async () => {
      const mockServerConfig = { listen: [":443"], routes: [] };
      mockFetch.mockResolvedValueOnce(mockOk(mockServerConfig));

      const stats = await getRateLimitStats();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/config/apps/http/servers/main"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("updateRateLimit — accepts all rate limit zone types", async () => {
      const zones = ["global", "per_ip", "per_tenant", "auth_per_ip", "llm_per_tenant"] as const;

      for (const zone of zones) {
        await expect(
          updateRateLimit({ zone, eventsPerWindow: 100, windowSeconds: 60 })
        ).resolves.not.toThrow();
      }
    });
  });

  // ── Express Middleware ───────────────────────────────────────────────────────

  describe("Express Middleware", () => {
    describe("requireCaddyRequestId", () => {
      it("passes through when X-Request-ID header is present", () => {
        const middleware = requireCaddyRequestId();
        const req = { headers: { "x-request-id": "req-abc-123" } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        middleware(req, res as never, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
      });

      it("passes through in development mode even without X-Request-ID", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";

        const middleware = requireCaddyRequestId();
        const req = { headers: {} };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        middleware(req, res as never, next);

        expect(next).toHaveBeenCalledOnce();
        process.env.NODE_ENV = originalEnv;
      });

      it("blocks request in production when X-Request-ID is missing", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        const middleware = requireCaddyRequestId();
        const req = { headers: {} };
        const jsonMock = vi.fn();
        const res = { status: vi.fn().mockReturnValue({ json: jsonMock }) };
        const next = vi.fn();

        middleware(req, res as never, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({ error: "MISSING_REQUEST_ID" })
        );

        process.env.NODE_ENV = originalEnv;
      });

      it("accepts X-Correlation-ID as an alternative to X-Request-ID", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        const middleware = requireCaddyRequestId();
        const req = { headers: { "x-correlation-id": "corr-xyz-789" } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        middleware(req, res as never, next);

        expect(next).toHaveBeenCalledOnce();
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe("extractCaddyAuthHeaders", () => {
      it("extracts user claims from Caddy-forwarded headers", () => {
        const middleware = extractCaddyAuthHeaders();
        const req = {
          headers: {
            "x-user-id": "user-12345",
            "x-user-email": "alice@54bank.com",
            "x-user-role": "branch-manager",
            "x-tenant-id": "tenant-lagos-001",
          },
        };
        const next = vi.fn();

        middleware(req, {}, next);

        expect(req.user).toEqual({
          id: "user-12345",
          email: "alice@54bank.com",
          role: "branch-manager",
          tenantId: "tenant-lagos-001",
        });
        expect(next).toHaveBeenCalledOnce();
      });

      it("sets empty strings for missing auth headers", () => {
        const middleware = extractCaddyAuthHeaders();
        const req = { headers: {} };
        const next = vi.fn();

        middleware(req, {}, next);

        expect(req.user).toEqual({
          id: "",
          email: "",
          role: "",
          tenantId: "",
        });
        expect(next).toHaveBeenCalledOnce();
      });

      it("always calls next regardless of header presence", () => {
        const middleware = extractCaddyAuthHeaders();
        const req = { headers: { "x-user-id": "admin-001" } };
        const next = vi.fn();

        middleware(req, {}, next);

        expect(next).toHaveBeenCalledOnce();
      });
    });
  });

  // ── End-to-End Stakeholder Scenarios ─────────────────────────────────────────

  describe("Stakeholder Scenarios via Caddy Gateway", () => {
    it("Retail Customer — request passes through Caddy with auth headers", () => {
      const middleware = extractCaddyAuthHeaders();
      const req = {
        headers: {
          "x-user-id": "cust-001",
          "x-user-email": "john.doe@example.com",
          "x-user-role": "retail-customer",
          "x-tenant-id": "tenant-abuja-001",
          "x-request-id": "req-abc-001",
        },
      };
      const next = vi.fn();
      middleware(req, {}, next);

      expect(req.user?.role).toBe("retail-customer");
      expect(req.user?.tenantId).toBe("tenant-abuja-001");
    });

    it("Branch Manager — request includes branch-manager role", () => {
      const middleware = extractCaddyAuthHeaders();
      const req = {
        headers: {
          "x-user-id": "mgr-001",
          "x-user-role": "branch-manager",
          "x-tenant-id": "tenant-lagos-001",
        },
      };
      const next = vi.fn();
      middleware(req, {}, next);

      expect(req.user?.role).toBe("branch-manager");
    });

    it("System Admin — can register a new service route via Caddy Admin API", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await expect(
        registerServiceRoute({
          serviceId: "new-microservice",
          hostPattern: "*.54bank.local",
          pathPrefix: "/api/v1/new",
          upstreamAddress: "new-microservice:8200",
          requireAuth: true,
        })
      ).resolves.not.toThrow();
    });

    it("DevOps Engineer — can reload Caddy config without downtime", async () => {
      mockFetch.mockResolvedValueOnce(mockOk({}));

      await expect(reloadCaddyConfig({ apps: { http: {} } })).resolves.not.toThrow();
    });

    it("Security Officer — can switch WAF to prevention mode", async () => {
      await expect(setWafEnforcementMode("prevention")).resolves.not.toThrow();
    });

    it("Security Officer — can check for expiring TLS certificates", async () => {
      mockFetch.mockResolvedValueOnce(mockOk([]));

      const expiring = await checkExpiringCertificates(30);
      expect(Array.isArray(expiring)).toBe(true);
    });

    it("Platform Engineer — can issue mTLS cert for new service", async () => {
      mockFetch.mockResolvedValueOnce(
        mockOk({ certificate: "-----BEGIN CERT-----", private_key: "-----BEGIN KEY-----" })
      );

      const cert = await issueInternalCertificate({
        commonName: "treasury-liquidity.internal",
        sans: ["treasury-liquidity", "treasury-liquidity.54link-dev.svc.cluster.local"],
      });

      expect(cert.certificate).toBeTruthy();
      expect(cert.private_key).toBeTruthy();
    });
  });
});
