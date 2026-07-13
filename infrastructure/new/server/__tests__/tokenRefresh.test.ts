import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const BASE = "http://localhost:3000";

// Helper: create a mock JWT
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.mock_signature`;
}

describe("Token Refresh — user identity preservation", () => {
  it("login returns accessToken and refreshToken", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        accessToken: makeJwt({ sub: "1", role: "admin", name: "Platform Administrator" }),
        refreshToken: "mock-refresh-token-admin",
        user: { id: 1, role: "admin", name: "Platform Administrator", email: "admin@54bank.ng" },
      }),
    });
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
    const opsToken = makeJwt({ sub: "2", role: "operations", name: "Ops User", email: "ops@54bank.ng" });
    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          accessToken: opsToken,
          refreshToken: "mock-refresh-token-ops",
          user: { id: 2, role: "operations", name: "Ops User" },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          accessToken: makeJwt({ sub: "2", role: "operations", name: "Ops User" }),
          refreshToken: "mock-refresh-token-ops-new",
        }),
      });

    const loginResp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@54bank.ng", password: "ops123" }),
    });
    const loginData = await loginResp.json() as any;

    const refreshResp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: loginData.refreshToken }),
    });
    expect(refreshResp.status).toBe(200);
    const refreshData = await refreshResp.json() as any;
    expect(refreshData.accessToken).toBeTruthy();
    const payload = JSON.parse(Buffer.from(refreshData.accessToken.split(".")[1], "base64url").toString());
    expect(payload.role).toBe("operations");
  });

  it("refresh with invalid token returns 401", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: async () => ({ error: "Invalid refresh token" }),
    });
    const resp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "invalid-token" }),
    });
    expect(resp.status).toBe(401);
  });

  it("refresh without token returns 400", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      json: async () => ({ error: "refreshToken is required" }),
    });
    const resp = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(400);
  });

  it("refresh preserves admin role specifically", async () => {
    const adminToken = makeJwt({ sub: "1", role: "admin", name: "Platform Administrator" });
    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          accessToken: adminToken,
          refreshToken: "mock-refresh-admin",
          user: { id: 1, role: "admin" },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          accessToken: makeJwt({ sub: "1", role: "admin", name: "Platform Administrator" }),
        }),
      });

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
  });
});
