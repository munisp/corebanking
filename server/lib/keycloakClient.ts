/**
 * Keycloak OAuth2 / OpenID Connect Client
 * Connects to Keycloak when KEYCLOAK_URL is set, falls back to local JWT auth.
 */

import { logger } from "./logger";

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  connected: boolean;
  mode: "keycloak" | "local";
  error: string | null;
}

const config: KeycloakConfig = {
  url: process.env.KEYCLOAK_URL || "http://localhost:8080",
  realm: process.env.KEYCLOAK_REALM || "54bank",
  clientId: process.env.KEYCLOAK_CLIENT_ID || "54bank-platform",
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
  connected: false,
  mode: "local",
  error: null,
};

export async function initKeycloak(): Promise<void> {
  const url = config.url;
  logger.info(`[Keycloak] Probing ${url}/realms/${config.realm}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/realms/${config.realm}/.well-known/openid-configuration`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      config.connected = true;
      config.mode = "keycloak";
      const oidc = await res.json() as Record<string, unknown>;
      logger.info(`[Keycloak] Connected — OIDC issuer: ${oidc.issuer}`);
    } else {
      config.error = `HTTP ${res.status}`;
      config.mode = "local";
      logger.warn(`[Keycloak] ${config.error} — using local JWT auth`);
    }
  } catch (err: any) {
    config.error = err.message;
    config.mode = "local";
    logger.warn(`[Keycloak] Not reachable: ${err.message} — using local JWT auth`);
  }
}

export function getKeycloakStatus() {
  return { ...config };
}

// OAuth2 Authorization Code flow endpoints
export interface OAuth2Endpoints {
  authorize: string;
  token: string;
  userinfo: string;
  logout: string;
  jwks: string;
}

export function getOAuth2Endpoints(): OAuth2Endpoints {
  const base = `${config.url}/realms/${config.realm}/protocol/openid-connect`;
  return {
    authorize: `${base}/auth`,
    token: `${base}/token`,
    userinfo: `${base}/userinfo`,
    logout: `${base}/logout`,
    jwks: `${base}/certs`,
  };
}

// Token introspection
export async function introspectToken(token: string): Promise<{ active: boolean; [key: string]: unknown }> {
  if (!config.connected) {
    return { active: false, reason: "keycloak_not_connected" };
  }

  try {
    const res = await fetch(`${config.url}/realms/${config.realm}/protocol/openid-connect/token/introspect`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    return (await res.json()) as { active: boolean };
  } catch {
    return { active: false, reason: "introspection_failed" };
  }
}

// Session rotation — invalidate existing sessions for a user
export async function rotateSession(userId: string): Promise<boolean> {
  if (!config.connected || !config.clientSecret) return false;

  try {
    // Get admin token
    const tokenRes = await fetch(`${config.url}/realms/${config.realm}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Logout user sessions
    await fetch(`${config.url}/admin/realms/${config.realm}/users/${userId}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    return true;
  } catch {
    return false;
  }
}
