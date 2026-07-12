import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

describe("Token Refresh — user identity preservation", () => {
  it("login returns accessToken and refreshToken", async () => {
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "admin" }),
    });
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.user.role).toBe("admin");
    expect(data.user.name).toBe("Platform Administrator");
  });

  it("refresh preserves user role and identity", async () => {
    // Login first
    const loginResp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@54bank.ng", password: "ops123" }),
    });
    const loginData = await loginResp.json() as any;

    // Refresh token
    const refreshResp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: loginData.refreshToken }),
    });
    expect(refreshResp.status).toBe(200);
    const refreshData = await refreshResp.json() as any;
    expect(refreshData.accessToken).toBeTruthy();

    // Decode JWT to verify claims preserved
    const payload = JSON.parse(Buffer.from(refreshData.accessToken.split(".")[1], "base64url").toString());
    expect(payload.role).toBe("operations");
    expect(payload.name).toBe("Operations Manager");
    expect(payload.email).toBe("ops@54bank.ng");
  });

  it("refresh with invalid token returns 401", async () => {
    const resp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "invalid.token.here" }),
    });
    expect(resp.status).toBe(401);
  });

  it("refresh without token returns 400", async () => {
    const resp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(400);
  });

  it("refresh preserves admin role specifically", async () => {
    const loginResp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "admin" }),
    });
    const loginData = await loginResp.json() as any;
    
    const refreshResp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: loginData.refreshToken }),
    });
    const refreshData = await refreshResp.json() as any;
    const payload = JSON.parse(Buffer.from(refreshData.accessToken.split(".")[1], "base64url").toString());
    expect(payload.role).toBe("admin");
    expect(payload.name).toBe("Platform Administrator");
  });
});
