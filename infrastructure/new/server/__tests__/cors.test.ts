import { describe, it, expect, beforeEach, afterEach } from "vitest";

// H-40 remediation: the previous version asserted properties of array and
// object literals declared in the test itself (e.g. `expect(prodOrigins)
// .toContain("https://app.54bank.ng")` on an array defined two lines above).
// These tests drive the real lib/corsPolicy middleware with mock req/res.
import { corsMiddleware } from "../lib/corsPolicy";

function mockReq(method: string, origin?: string) {
  return {
    method,
    headers: origin ? { origin } : {},
  } as any;
}

function mockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    headers,
    setHeader: (k: string, v: string) => { headers[k] = v; },
    sendStatus: (code: number) => { res.sentStatus = code; return res; },
  };
  return res;
}

function run(middleware: any, req: any, res: any) {
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  return nextCalled;
}

describe("CORS Policy (production lib/corsPolicy)", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("production: allow-listed origin is echoed with credentials", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    run(corsMiddleware(), mockReq("GET", "https://app.54bank.ng"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://app.54bank.ng");
    expect(res.headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(res.headers["Vary"]).toBe("Origin");
  });

  it("production: unknown origin is NOT reflected", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    run(corsMiddleware(), mockReq("GET", "https://evil.com"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("production: no wildcard is emitted when Origin header is absent", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    run(corsMiddleware(), mockReq("GET"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("development: localhost origins are allowed", () => {
    process.env.NODE_ENV = "development";
    const res = mockRes();
    run(corsMiddleware(), mockReq("GET", "http://localhost:3000"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
  });

  it("development: non-localhost origins are not reflected", () => {
    process.env.NODE_ENV = "development";
    const res = mockRes();
    run(corsMiddleware(), mockReq("GET", "https://evil.com"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("sets method/header allowlists and a 24h preflight cache", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    run(corsMiddleware(), mockReq("GET", "https://app.54bank.ng"), res);
    expect(res.headers["Access-Control-Allow-Methods"]).toContain("DELETE");
    expect(res.headers["Access-Control-Allow-Headers"]).toContain("Authorization");
    expect(res.headers["Access-Control-Allow-Headers"]).toContain("Idempotency-Key");
    expect(res.headers["Access-Control-Max-Age"]).toBe("86400");
  });

  it("OPTIONS preflight short-circuits with 204 and never reaches the handler", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    const nextCalled = run(corsMiddleware(), mockReq("OPTIONS", "https://app.54bank.ng"), res);
    expect(res.sentStatus).toBe(204);
    expect(nextCalled).toBe(false);
  });

  it("non-OPTIONS requests call next()", () => {
    process.env.NODE_ENV = "production";
    const nextCalled = run(corsMiddleware(), mockReq("GET", "https://app.54bank.ng"), mockRes());
    expect(nextCalled).toBe(true);
  });
});
