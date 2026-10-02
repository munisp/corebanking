import { createHmac } from "crypto";
import { readEnv } from "../config/readEnv.config";

// OB-03: Service-to-service authentication for orchestrator → identity-service
// calls. Mints a short-lived HS256 JWT signed with the shared JWT_SECRET.
// Claims: { sub: "orchestrator-service", role: "service", tenant_id, iat, exp }.
// The Python identity services (user-service, auth-service, admin-service,
// business-service) accept tokens with role="service" (see R1B middleware).

const TOKEN_TTL_SECONDS = 300; // 5 minutes
const REFRESH_SKEW_SECONDS = 30; // renew slightly before expiry

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch seconds
}

export class ServiceAuthClient {
  private static instance: ServiceAuthClient;
  private cache = new Map<string, CachedToken>();

  public static getInstance(): ServiceAuthClient {
    if (!ServiceAuthClient.instance) {
      ServiceAuthClient.instance = new ServiceAuthClient();
    }
    return ServiceAuthClient.instance;
  }

  private secret(): string {
    // readEnv throws at boot (EnvSchema) when JWT_SECRET is unset/too short.
    return readEnv("JWT_SECRET") as string;
  }

  public mintToken(tenantId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt - REFRESH_SKEW_SECONDS > now) {
      return cached.token;
    }

    const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64Url(
      JSON.stringify({
        sub: "orchestrator-service",
        role: "service",
        tenant_id: tenantId,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
      }),
    );
    const signature = createHmac("sha256", this.secret())
      .update(`${header}.${payload}`)
      .digest();
    const token = `${header}.${payload}.${base64Url(signature)}`;

    this.cache.set(tenantId, { token, expiresAt: now + TOKEN_TTL_SECONDS });
    return token;
  }

  public getAuthHeader(tenantId: string): string {
    return `Bearer ${this.mintToken(tenantId)}`;
  }
}

export const serviceAuthClient = ServiceAuthClient.getInstance();
