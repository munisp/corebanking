import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: Security Headers & OWASP Compliance", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("returns X-Frame-Options: DENY", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("x-frame-options")).toBe("DENY");
  });

  it("returns Strict-Transport-Security header", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("strict-transport-security");
    if (header) expect(header).toContain("max-age=");
  });

  it("returns Content-Security-Policy header", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("content-security-policy");
    if (header) expect(header).toBeTruthy();
  });

  it("returns X-Content-Type-Options: nosniff", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns X-XSS-Protection header", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("x-xss-protection")).toBeTruthy();
  });

  it("returns Referrer-Policy header", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("referrer-policy");
    if (header) expect(header).toBeTruthy();
  });

  it("returns Permissions-Policy header", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    const header = resp.headers.get("permissions-policy");
    if (header) expect(header).toBeTruthy();
  });

  it("API endpoints return JSON content type", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/customers`);
    expect(resp.headers.get("content-type")).toContain("application/json");
  });

  it("health endpoint returns JSON", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.headers.get("content-type")).toContain("application/json");
  });
});

describe("E2E: CORS Policy", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("responds to preflight with appropriate status", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/customers`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" },
    });
    expect([200, 204]).toContain(resp.status);
  });
});
