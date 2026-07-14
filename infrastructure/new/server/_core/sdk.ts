/**
 * Authentication SDK for 54Bank platform.
 * Uses Keycloak OIDC directly — no Manus-specific OAuth service dependency.
 *
 * Implements:
 *  - Session JWT signing/verification (HS256, jose)
 *  - Keycloak token exchange (authorization_code flow)
 *  - Keycloak userinfo endpoint
 *  - Request authentication middleware
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

export type KeycloakTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

export type KeycloakUserInfo = {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
};

// ─── Keycloak OIDC Client ─────────────────────────────────────────────────────

const keycloakBase = (): string => {
  const url = ENV.oAuthServerUrl || `http://localhost:8080`;
  const realm = process.env.KEYCLOAK_REALM ?? "54bank";
  return `${url.replace(/\/$/, "")}/realms/${realm}/protocol/openid-connect`;
};

const keycloakClient = axios.create({ timeout: 10_000 });

class KeycloakService {
  async exchangeCode(code: string, redirectUri: string): Promise<KeycloakTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "54bank-platform",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      code,
      redirect_uri: redirectUri,
    });
    const { data } = await keycloakClient.post<KeycloakTokenResponse>(
      `${keycloakBase()}/token`,
      params.toString(),
      { headers: { "content-type": "application/x-www-form-urlencoded" } }
    );
    return data;
  }

  async getUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
    const { data } = await keycloakClient.get<KeycloakUserInfo>(
      `${keycloakBase()}/userinfo`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    return data;
  }

  async refreshToken(refreshToken: string): Promise<KeycloakTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "54bank-platform",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
    });
    const { data } = await keycloakClient.post<KeycloakTokenResponse>(
      `${keycloakBase()}/token`,
      params.toString(),
      { headers: { "content-type": "application/x-www-form-urlencoded" } }
    );
    return data;
  }
}

// ─── Session Manager ──────────────────────────────────────────────────────────

class SDKServer {
  private keycloak = new KeycloakService();

  private getSessionSecret(): Uint8Array {
    const secret = ENV.cookieSecret;
    if (!secret) {
      throw new Error("JWT_SECRET is not configured. Set the JWT_SECRET environment variable.");
    }
    return new TextEncoder().encode(secret);
  }

  parseCookies(cookieHeader: string | undefined): Map<string, string> {
    if (!cookieHeader) return new Map();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      { openId, appId: ENV.appId, name: options.name ?? "" },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();
    return new SignJWT({ openId: payload.openId, appId: payload.appId, name: payload.name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ["HS256"] });
      const { openId, appId, name } = payload as Record<string, unknown>;
      if (
        typeof openId !== "string" || !openId ||
        typeof appId !== "string" || !appId ||
        typeof name !== "string"
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async exchangeCodeForSession(
    code: string,
    redirectUri: string
  ): Promise<{ sessionToken: string; user: Partial<User> }> {
    const tokens = await this.keycloak.exchangeCode(code, redirectUri);
    const userInfo = await this.keycloak.getUserInfo(tokens.access_token);
    const openId = userInfo.sub;
    const name = userInfo.name ?? userInfo.preferred_username ?? openId;
    const email = userInfo.email ?? null;
    const signedInAt = new Date();
    await db.upsertUser({ openId, name, email, loginMethod: "keycloak", lastSignedIn: signedInAt });
    const sessionToken = await this.createSessionToken(openId, { name });
    return { sessionToken, user: { openId, name, email } };
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid or missing session cookie");
    }
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(session.openId);
    if (!user) {
      // Auto-provision user from session data (Keycloak already validated)
      await db.upsertUser({
        openId: session.openId,
        name: session.name ?? null,
        email: null,
        loginMethod: "keycloak",
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(session.openId);
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await db.upsertUser({ openId: user.openId, lastSignedIn: signedInAt });
    return user;
  }
}

export const sdk = new SDKServer();
