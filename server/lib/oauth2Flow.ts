/**
 * OAuth2 Authorization Code Flow — End-to-End SSO Implementation
 * Supports Keycloak as IdP with fallback to local JWT auth.
 * Implements: authorize → callback → token exchange → userinfo → logout
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { logger } from "./logger";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "54bank";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "54bank-platform";
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.OAUTH2_REDIRECT_URI || "http://localhost:3000/api/auth/oauth2/callback";
const JWT_SECRET = process.env.JWT_SECRET || "54bank-dev-secret-key-change-in-production";

const oidcBase = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect`;

// In-memory PKCE + state storage (use Redis in production)
const pendingFlows = new Map<string, { codeVerifier: string; redirectTo: string; expiresAt: number }>();

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function signLocalJWT(payload: Record<string, unknown>, expiresIn = "8h"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = expiresIn.endsWith("h")
    ? parseInt(expiresIn) * 3600
    : parseInt(expiresIn) * 60;
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: now, exp: now + expSeconds })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

// Cleanup expired PKCE flows
setInterval(() => {
  const now = Date.now();
  pendingFlows.forEach((flow, key) => {
    if (flow.expiresAt < now) pendingFlows.delete(key);
  });
}, 60_000);

export function registerOAuth2Endpoints(app: Express) {
  // Step 1: Initiate OAuth2 Authorization Code flow
  app.get("/api/auth/oauth2/authorize", (req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString("hex");
    const { verifier, challenge } = generatePKCE();
    const redirectTo = (req.query.redirect as string) || "/";

    pendingFlows.set(state, {
      codeVerifier: verifier,
      redirectTo,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${oidcBase}/auth?${params}`;
    logger.info(`[OAuth2] Redirecting to Keycloak authorize: state=${state}`);

    // If Keycloak is unreachable, fall back to local login page
    res.json({
      authUrl,
      state,
      fallbackLogin: "/api/auth/login",
      provider: "keycloak",
      pkceEnabled: true,
    });
  });

  // Step 2: Handle OAuth2 callback with authorization code
  app.get("/api/auth/oauth2/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({
        error: "oauth2_error",
        description: req.query.error_description || error,
      });
    }

    if (!code || !state) {
      return res.status(400).json({ error: "missing_params", message: "code and state required" });
    }

    const flow = pendingFlows.get(state as string);
    if (!flow) {
      return res.status(400).json({ error: "invalid_state", message: "State expired or invalid" });
    }
    pendingFlows.delete(state as string);

    try {
      // Exchange authorization code for tokens
      const tokenResp = await fetch(`${oidcBase}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
          code_verifier: flow.codeVerifier,
        }),
      });

      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        logger.warn(`[OAuth2] Token exchange failed: ${err}`);
        return res.status(401).json({ error: "token_exchange_failed", details: err });
      }

      const tokens = (await tokenResp.json()) as {
        access_token: string;
        refresh_token: string;
        id_token: string;
        expires_in: number;
        token_type: string;
      };

      // Fetch userinfo
      const userinfoResp = await fetch(`${oidcBase}/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userinfo = userinfoResp.ok ? await userinfoResp.json() : {};

      logger.info(`[OAuth2] SSO login success: ${(userinfo as any).email || (userinfo as any).preferred_username}`);

      res.json({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        user: userinfo,
        ssoProvider: "keycloak",
        redirectTo: flow.redirectTo,
      });
    } catch (err: any) {
      logger.error(`[OAuth2] Callback error: ${err.message}`);

      // Fallback: generate local JWT if Keycloak is down
      const fallbackToken = signLocalJWT({
        sub: "sso-fallback",
        role: "user",
        ssoFallback: true,
      });

      res.json({
        accessToken: fallbackToken,
        refreshToken: null,
        user: { email: "sso-user@54bank.ng", role: "user" },
        ssoProvider: "local-fallback",
        redirectTo: flow.redirectTo,
        warning: "Keycloak unreachable, using local authentication",
      });
    }
  });

  // Step 3: Token refresh via Keycloak
  app.post("/api/auth/oauth2/refresh", async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "refresh_token_required" });
    }

    try {
      const resp = await fetch(`${oidcBase}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
          ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
        }),
      });

      if (!resp.ok) {
        return res.status(401).json({ error: "refresh_failed" });
      }

      const tokens = await resp.json();
      res.json(tokens);
    } catch {
      res.status(502).json({ error: "keycloak_unreachable" });
    }
  });

  // Step 4: Userinfo endpoint
  app.get("/api/auth/oauth2/userinfo", async (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ error: "token_required" });
    }

    try {
      const resp = await fetch(`${oidcBase}/userinfo`, {
        headers: { Authorization: auth },
      });
      if (resp.ok) {
        res.json(await resp.json());
      } else {
        res.status(resp.status).json({ error: "userinfo_failed" });
      }
    } catch {
      // Fallback: decode JWT locally
      const token = auth.replace("Bearer ", "");
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        res.json({
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          source: "local-jwt",
        });
      } catch {
        res.status(401).json({ error: "invalid_token" });
      }
    }
  });

  // Step 5: SSO Logout (front-channel + back-channel)
  app.post("/api/auth/oauth2/logout", async (req: Request, res: Response) => {
    const { idToken, refreshToken: rt } = req.body;

    try {
      // Keycloak back-channel logout
      if (rt) {
        await fetch(`${oidcBase}/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
            refresh_token: rt,
          }),
        });
      }
    } catch {
      // Keycloak might be unreachable
    }

    res.json({
      loggedOut: true,
      frontChannelLogoutUrl: idToken
        ? `${oidcBase}/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${encodeURIComponent("http://localhost:3000/login")}`
        : null,
    });
  });

  // OAuth2 discovery endpoint
  app.get("/api/auth/oauth2/.well-known/openid-configuration", (_req: Request, res: Response) => {
    res.json({
      issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
      authorization_endpoint: "/api/auth/oauth2/authorize",
      token_endpoint: "/api/auth/oauth2/callback",
      userinfo_endpoint: "/api/auth/oauth2/userinfo",
      end_session_endpoint: "/api/auth/oauth2/logout",
      jwks_uri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
      scopes_supported: ["openid", "profile", "email", "roles"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    });
  });

  logger.info("[OAuth2] SSO endpoints registered: authorize, callback, refresh, userinfo, logout, discovery");
}
