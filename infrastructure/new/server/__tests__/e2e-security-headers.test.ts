import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: Security Headers & OWASP Compliance", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("returns X-Frame-Options: DENY", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("x-frame-options")).toBe("DENY");
  });

  it("returns Strict-Transport-Security header", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("strict-transport-security");
    expect(header, "HSTS header must always be set by lib/securityHardening").toContain("max-age=");
  });

  it("returns Content-Security-Policy header", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("content-security-policy");
    expect(header, "security header must always be set by lib/securityHardening").toBeTruthy();
  });

  it("returns X-Content-Type-Options: nosniff", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns X-XSS-Protection header", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("x-xss-protection")).toBeTruthy();
  });

  it("returns Referrer-Policy header", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("referrer-policy");
    expect(header, "security header must always be set by lib/securityHardening").toBeTruthy();
  });

  it("returns Permissions-Policy header", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("permissions-policy");
    expect(header, "security header must always be set by lib/securityHardening").toBeTruthy();
  });

  it("API endpoints return JSON content type", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/api/db/customers`);
    expect(resp.headers.get("content-type")).toContain("application/json");
  });

  it("health endpoint returns JSON", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("content-type")).toContain("application/json");
  });
});

describe("E2E: CORS Policy", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("responds to preflight with appropriate status", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/api/db/customers`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" },
    });
    expect([200, 204]).toContain(resp.status);
  });
});
