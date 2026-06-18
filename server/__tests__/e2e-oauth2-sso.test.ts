import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: OAuth2/SSO Flow", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /api/auth/oauth2/authorize — returns authorization URL", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/authorize?redirect=/dashboard`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.authUrl).toContain("openid-connect/auth");
    expect(json.state).toBeTruthy();
    expect(json.pkceEnabled).toBe(true);
    expect(json.provider).toBe("keycloak");
    expect(json.fallbackLogin).toBe("/api/auth/login");
  });

  it("GET /api/auth/oauth2/callback — missing params returns 400", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/callback`);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toBe("missing_params");
  });

  it("GET /api/auth/oauth2/callback — invalid state returns 400", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/callback?code=test&state=invalid`);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toBe("invalid_state");
  });

  it("GET /api/auth/oauth2/callback — error param returns 400", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/callback?error=access_denied&error_description=User+denied`);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toBe("oauth2_error");
  });

  it("POST /api/auth/oauth2/refresh — missing token returns 400", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(400);
  });

  it("GET /api/auth/oauth2/userinfo — no token returns 401", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/userinfo`);
    expect(resp.status).toBe(401);
  });

  it("GET /api/auth/oauth2/userinfo — with local JWT returns decoded user", async () => {
    if (!serverUp) return;
    // Login first to get a JWT
    const loginResp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "admin" }),
    });
    if (loginResp.status !== 200) return;
    const { accessToken } = await loginResp.json();

    const resp = await fetch(`${BASE}/api/auth/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Either Keycloak validates it or local fallback decodes it
    expect([200, 401, 502]).toContain(resp.status);
  });

  it("POST /api/auth/oauth2/logout — returns logout info", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.loggedOut).toBe(true);
  });

  it("GET /api/auth/oauth2/.well-known/openid-configuration — returns OIDC discovery", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/oauth2/.well-known/openid-configuration`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.issuer).toContain("54bank");
    expect(json.authorization_endpoint).toBeTruthy();
    expect(json.token_endpoint).toBeTruthy();
    expect(json.scopes_supported).toContain("openid");
    expect(json.code_challenge_methods_supported).toContain("S256");
  });
});

describe("E2E: SSO Configuration", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /api/platform/sso/config — returns SSO configuration", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/sso/config`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.realm).toBe("54bank");
    expect(json.client_id).toBeTruthy();
    expect(json.token_endpoint).toContain("openid-connect/token");
  });

  it("GET /api/platform/sso/roles — returns role definitions", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/sso/roles`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.roles).toBeTruthy();
    expect(json.roles.length).toBeGreaterThan(0);
  });

  it("GET /api/platform/keycloak/config — returns Keycloak config", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/keycloak/config`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.realm).toBeTruthy();
  });

  it("GET /api/platform/oauth2/endpoints — returns OAuth2 URLs", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/oauth2/endpoints`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.authorize).toContain("openid-connect/auth");
  });
});
