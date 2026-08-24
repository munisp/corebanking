import { describe, it, expect, beforeEach, afterEach } from "vitest";

// H-40 remediation: the previous version re-implemented jwtUtil, hashPassword
// and the RBAC matrix *inside the test file* and asserted against those
// copies — a pure self-test that production changes could never break. These
// tests import the real auth module and drive its exported middleware with
// mock Express req/res objects.
import {
  createAuthMiddleware,
  requireRole,
  requirePermission,
} from "../lib/auth";

function mockReq(overrides: Record<string, any> = {}) {
  return {
    path: "/api/accounts",
    headers: {},
    cookies: {},
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

function run(middleware: any, req: any, res: any) {
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  return nextCalled;
}

describe("createAuthMiddleware (production lib/auth)", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.ENFORCE_AUTH = "true"; // never fall through to a dev user
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns 401 AUTH_REQUIRED when no token is presented", () => {
    const mw = createAuthMiddleware();
    const res = mockRes();
    const nextCalled = run(mw, mockReq(), res);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 INVALID_TOKEN for a garbage bearer token", () => {
    const mw = createAuthMiddleware();
    const res = mockRes();
    const nextCalled = run(
      mw,
      mockReq({ headers: { authorization: "Bearer not-a-real-token" } }),
      res,
    );
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("lets auth endpoints and health checks through without a token", () => {
    const mw = createAuthMiddleware();
    for (const path of ["/api/auth/login", "/api/auth/refresh", "/api/healthz", "/api/platform/health"]) {
      const res = mockRes();
      const nextCalled = run(mw, mockReq({ path }), res);
      expect(nextCalled).toBe(true);
      expect(res.statusCode).toBeUndefined();
    }
  });

  it("does not guard non-API paths", () => {
    const mw = createAuthMiddleware();
    const nextCalled = run(mw, mockReq({ path: "/assets/logo.png" }), mockRes());
    expect(nextCalled).toBe(true);
  });
});

describe("requireRole (production lib/auth)", () => {
  it("rejects unauthenticated requests with 401", () => {
    const res = mockRes();
    const nextCalled = run(requireRole("operations"), mockReq(), res);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("admits a user holding the required role", () => {
    const req = mockReq();
    (req as any).user = { role: "operations" };
    const nextCalled = run(requireRole("operations", "admin"), req, mockRes());
    expect(nextCalled).toBe(true);
  });

  it("admin bypasses every role gate", () => {
    const req = mockReq();
    (req as any).user = { role: "admin" };
    const nextCalled = run(requireRole("treasury"), req, mockRes());
    expect(nextCalled).toBe(true);
  });

  it("rejects a user without the role with 403 and details", () => {
    const req = mockReq();
    (req as any).user = { role: "branch" };
    const res = mockRes();
    const nextCalled = run(requireRole("treasury"), req, res);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.required).toContain("treasury");
    expect(res.body.current).toBe("branch");
  });
});

describe("requirePermission (production lib/auth RBAC matrix)", () => {
  const withRole = (role: string) => {
    const req = mockReq();
    (req as any).user = { role };
    return req;
  };

  it("operations may write payments but not AML", () => {
    expect(run(requirePermission("write:payments"), withRole("operations"), mockRes())).toBe(true);

    const res = mockRes();
    expect(run(requirePermission("write:aml"), withRole("operations"), res)).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("compliance may write AML/KYC but not core banking", () => {
    expect(run(requirePermission("write:aml"), withRole("compliance"), mockRes())).toBe(true);
    expect(run(requirePermission("write:kyc"), withRole("compliance"), mockRes())).toBe(true);

    const res = mockRes();
    expect(run(requirePermission("write:core-banking"), withRole("compliance"), res)).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("auditor reads anything but writes nothing", () => {
    expect(run(requirePermission("read:anything"), withRole("auditor"), mockRes())).toBe(true);

    const res = mockRes();
    expect(run(requirePermission("write:anything"), withRole("auditor"), res)).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("branch teller role is denied platform-level writes", () => {
    const res = mockRes();
    expect(run(requirePermission("write:payments"), withRole("branch"), res)).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.required).toBe("write:payments");
  });

  it("unknown roles fall back to the least-privilege 'user' role", () => {
    const res = mockRes();
    expect(run(requirePermission("write:payments"), withRole("no-such-role"), res)).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
