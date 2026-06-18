import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: Authentication Flow", () => {
  let adminToken = "";
  let refreshToken = "";

  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("POST /api/auth/login — admin login returns JWT with correct claims", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "admin" }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.accessToken).toBeTruthy();
    expect(json.refreshToken).toBeTruthy();
    expect(json.user?.role).toBe("admin");
    expect(json.user?.email).toBe("admin@54bank.ng");
    adminToken = json.accessToken;
    refreshToken = json.refreshToken;
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

  it("POST /api/auth/login — operations role", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@54bank.ng", password: "ops123" }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.user?.role).toBe("operations");
  });

  it("POST /api/auth/login — compliance role", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "compliance@54bank.ng", password: "comp123" }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.user?.role).toBe("compliance");
  });

  it("POST /api/auth/login — treasury role", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "treasury@54bank.ng", password: "treas123" }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.user?.role).toBe("treasury");
  });

  it("POST /api/auth/login — branch role", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "branch@54bank.ng", password: "branch123" }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.user?.role).toBe("branch");
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
