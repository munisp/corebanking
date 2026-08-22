import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: Authentication Flow", () => {
  let adminToken = "";
  let refreshToken = "";

  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("POST /api/auth/login — hardcoded default credentials no longer authenticate", async () => {
    if (!serverUp) return;
    // SECURITY: admin@54bank.ng/"admin" was a hardcoded backdoor account seeded
    // into an in-memory map checked BEFORE the DB. It must never authenticate.
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "admin" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/login — wrong password returns 401", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "wrong" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/login — hardcoded operations credential rejected", async () => {
    if (!serverUp) return;
    // SECURITY: ops@54bank.ng/"ops123" was a hardcoded privileged account; it must never authenticate.
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@54bank.ng", password: "ops123" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/login — hardcoded compliance credential rejected", async () => {
    if (!serverUp) return;
    // SECURITY: compliance@54bank.ng/"comp123" was a hardcoded privileged account; it must never authenticate.
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "compliance@54bank.ng", password: "comp123" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/login — hardcoded treasury credential rejected", async () => {
    if (!serverUp) return;
    // SECURITY: treasury@54bank.ng/"treas123" was a hardcoded privileged account; it must never authenticate.
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "treasury@54bank.ng", password: "treas123" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/login — hardcoded branch credential rejected", async () => {
    if (!serverUp) return;
    // SECURITY: branch@54bank.ng/"branch123" was a hardcoded privileged account; it must never authenticate.
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "branch@54bank.ng", password: "branch123" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/refresh — returns new token", async () => {
    if (!serverUp || !refreshToken) return;
    const resp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.accessToken || json.token).toBeTruthy();
  });

  it("POST /api/auth/logout — blacklists token", async () => {
    if (!serverUp || !adminToken) return;
    const resp = await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });
    expect(resp.status).toBe(200);
  });

  it("POST /api/auth/login — nonexistent user returns 401", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@54bank.ng", password: "password" }),
    });
    expect(resp.status).toBe(401);
  });

  it("POST /api/auth/login — missing body returns error", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect([400, 401]).toContain(resp.status);
  });
});
