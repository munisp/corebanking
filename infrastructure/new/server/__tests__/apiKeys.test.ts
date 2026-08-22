import { describe, it, expect } from "vitest";

// H-40 remediation: the previous version asserted properties of an array of
// object literals declared in the test itself — production API-key handling
// could be entirely absent and the suite stayed green. These tests register
// the real lib/apiKeyManagement routes on a mock Express app and drive the
// production validateApiKey middleware with mock req/res.
import { registerApiKeyRoutes, validateApiKey } from "../lib/apiKeyManagement";

type Handler = (req: any, res: any) => any;

function mockApp() {
  const routes: Record<string, Handler> = {};
  return {
    post: (path: string, h: Handler) => { routes[`POST ${path}`] = h; },
    get: (path: string, h: Handler) => { routes[`GET ${path}`] = h; },
    delete: (path: string, h: Handler) => { routes[`DELETE ${path}`] = h; },
    routes,
  };
}

function mockRes() {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

const app = mockApp();
registerApiKeyRoutes(app as any);

const adminReq = (body: any = {}) => ({ user: { id: 7, role: "admin" }, body });
const userReq = (body: any = {}) => ({ user: { id: 7, role: "user" }, body });

function createKey(req: any) {
  const res = mockRes();
  app.routes["POST /api/auth/api-keys"]!(req, res);
  return res;
}

function listKeys() {
  const res = mockRes();
  app.routes["GET /api/auth/api-keys"]!(adminReq(), res);
  return res.body;
}

function runValidator(key?: string) {
  const req: any = { headers: key ? { "x-api-key": key } : {} };
  const res = mockRes();
  let nextCalled = false;
  validateApiKey(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

describe("API Key Management (production lib/apiKeyManagement)", () => {
  it("creation requires an admin user (403 otherwise)", () => {
    expect(createKey(userReq({ name: "svc" })).statusCode).toBe(403);
    expect(createKey({ body: { name: "svc" } }).statusCode).toBe(403);
  });

  it("creation requires a name (400 otherwise)", () => {
    expect(createKey(adminReq({})).statusCode).toBe(400);
  });

  it("returns a 54bk_ key once; the list endpoint never exposes it", () => {
    const res = createKey(adminReq({ name: "payment-gateway", scopes: ["read", "write"] }));
    expect(res.statusCode).toBe(201);
    expect(res.body.key).toMatch(/^54bk_[0-9a-f]{8}_[0-9a-f]{64}$/);

    const list = listKeys();
    const stored = list.keys.find((k: any) => k.name === "payment-gateway");
    expect(stored).toBeDefined();
    expect(stored.key).toBeUndefined(); // only a hash is stored — never the key
    expect(JSON.stringify(list)).not.toContain(res.body.key);
  });

  it("middleware passes requests without an API key through (JWT path)", () => {
    const { res, nextCalled } = runValidator(undefined);
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeUndefined();
  });

  it("middleware rejects an unknown key with 401 INVALID_API_KEY", () => {
    const { res, nextCalled } = runValidator("54bk_00000000_" + "0".repeat(64));
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("INVALID_API_KEY");
  });

  it("middleware admits a valid key and stamps a service identity", () => {
    const created = createKey(adminReq({ name: "ledger-svc", scopes: ["write"] }));
    const { req, nextCalled } = runValidator(created.body.key);
    expect(nextCalled).toBe(true);
    expect(req.user.role).toBe("service");
    expect(req.user.name).toBe("ledger-svc");
  });

  it("enforces the per-key rate limit with 429 + retryAfter", () => {
    const created = createKey(adminReq({ name: "limited-svc", rateLimit: 3 }));
    const key = created.body.key;

    for (let i = 0; i < 3; i++) {
      expect(runValidator(key).nextCalled).toBe(true);
    }
    const { res, nextCalled } = runValidator(key);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body.retryAfter).toBe(60);
  });

  it("revoked keys are rejected immediately", () => {
    const created = createKey(adminReq({ name: "doomed-svc" }));
    const del = mockRes();
    app.routes["DELETE /api/auth/api-keys/:id"](
      { params: { id: created.body.id }, user: { id: 7, role: "admin" } },
      del,
    );
    expect(del.body).toEqual({ revoked: true, name: "doomed-svc" });

    const { res, nextCalled } = runValidator(created.body.key);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("rotation invalidates the old key and issues a new one", () => {
    const created = createKey(adminReq({ name: "rotate-svc" }));
    const rotated = mockRes();
    app.routes["POST /api/auth/api-keys/:id/rotate"](
      { params: { id: created.body.id }, user: { id: 7, role: "admin" } },
      rotated,
    );
    expect(rotated.body.key).toMatch(/^54bk_/);
    expect(rotated.body.key).not.toBe(created.body.key);

    expect(runValidator(created.body.key).nextCalled).toBe(false); // old key dead
    expect(runValidator(rotated.body.key).nextCalled).toBe(true);  // new key live
  });
});
